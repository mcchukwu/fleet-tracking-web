import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../auth/store";
import { api } from "../api/instance";
import { vehiclesFixture } from "../mocks/fixtures/vehicles";
import { resetConnection, useConnectionStore } from "../stores/connection";
import { useLiveStore } from "../stores/live";
import { ToastProvider } from "../ui/Toast";
import { LiveProvider } from "./LiveProvider";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  closed = false;
  readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  constructor() {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  send(frame: unknown): void {
    this.emit("message", { data: JSON.stringify(frame) });
  }
}

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

function position(vehicleId: string, index: number) {
  return {
    type: "position",
    tenant_id: "tenant-demo",
    vehicle_id: vehicleId,
    lat: 6.5,
    lon: 3.4,
    recorded_at: new Date(Date.now() + index * 1_000).toISOString(),
  };
}

function alert(vehicleId: string, index: number, severity = "high", type = "speeding") {
  return {
    type: "alert",
    tenant_id: "tenant-demo",
    vehicle_id: vehicleId,
    alert: {
      type,
      severity,
      occurred_at: new Date(Date.now() - index * 1_000).toISOString(),
    },
  };
}

async function start(): Promise<FakeWebSocket> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <LiveProvider>
          <div />
        </LiveProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  const socket = FakeWebSocket.instances[0];
  if (!socket) throw new Error("socket was not created");
  socket.emit("open");
  await waitFor(() => expect(useLiveStore.getState().knownKeys.size).toBeGreaterThan(0));
  return socket;
}

beforeEach(() => {
  useLiveStore.getState().reset();
  resetConnection();
  useAuthStore.getState().setSession(user, "csrf");
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.spyOn(api, "liveSnapshot").mockResolvedValue({ data: vehiclesFixture });
});

afterEach(() => {
  useLiveStore.getState().reset();
  useAuthStore.getState().clear();
  vi.unstubAllGlobals();
});

describe("LiveProvider", () => {
  it("applies a whole frame batch as one store write", async () => {
    const socket = await start();
    const before = useLiveStore.getState();

    socket.send(position("demo-imei-0001", 0));
    socket.send(position("demo-imei-0002", 1));
    socket.send(position("demo-imei-0003", 2));

    await waitFor(() => {
      expect(useLiveStore.getState().frameCount).toBe(3);
    });
    const after = useLiveStore.getState();
    expect(after.batchCount - before.batchCount).toBe(1);
    expect(after.frameCount - before.frameCount).toBe(3);
  });

  it("advances the live data clock when a position frame arrives", async () => {
    const socket = await start();
    const before = useConnectionStore.getState().lastDataAt;

    socket.send(position("demo-imei-0001", 0));

    await waitFor(() => {
      expect(useConnectionStore.getState().lastDataAt).toBeGreaterThan(before ?? 0);
    });
  });

  it("uses the newest frame timestamp for the live data clock", async () => {
    const socket = await start();
    const recordedAt = new Date(Date.now() - 60_000).toISOString();

    socket.send({
      type: "position",
      tenant_id: "tenant-demo",
      vehicle_id: "demo-imei-0001",
      lat: 6.5,
      lon: 3.4,
      recorded_at: recordedAt,
    });

    await waitFor(() => {
      expect(useConnectionStore.getState().lastDataAt).toBe(Date.parse(recordedAt));
    });
  });

  it("drops malformed frames without disturbing the socket", async () => {
    const socket = await start();
    socket.emit("message", { data: "{not json" });
    socket.emit("message", { data: JSON.stringify({ type: "position", lat: "north" }) });
    socket.send(position("demo-imei-0001", 0));

    await waitFor(() => {
      expect(useLiveStore.getState().frameCount).toBe(1);
    });
    expect(socket.closed).toBe(false);
  });

  it("coalesces an alert burst split across frames into one summary", async () => {
    const socket = await start();

    for (let index = 0; index < 12; index += 1) {
      socket.send(alert(`demo-imei-00${String(10 + (index % 9)).padStart(2, "0")}`, index));
      if (index === 5) await new Promise((resolve) => setTimeout(resolve, 30));
    }

    expect(await screen.findByText("12 new alerts", undefined, { timeout: 3_000 })).toBeInTheDocument();
    expect(screen.getAllByText("12 new alerts")).toHaveLength(1);
  });

  it("announces a critical alert assertively", async () => {
    const socket = await start();
    socket.send(alert("demo-imei-0001", 0, "critical"));

    await waitFor(() => {
      expect(document.querySelector('[aria-live="assertive"]')?.textContent).toContain("Speeding");
    });
  });

  it(
    "throttles alert announcements to one per five seconds",
    async () => {
      const socket = await start();

      socket.send(alert("demo-imei-0001", 0, "high", "speeding"));
      expect(await screen.findByText("Speeding")).toBeInTheDocument();

      socket.send(alert("demo-imei-0002", 1, "high", "idle"));
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(screen.queryByText("Idle")).not.toBeInTheDocument();

      expect(await screen.findByText("Idle", undefined, { timeout: 6_000 })).toBeInTheDocument();
    },
    12_000,
  );

  it("stops the socket when the session expires", async () => {
    const socket = await start();
    useAuthStore.getState().expire();
    await waitFor(() => expect(socket.closed).toBe(true));
  });
});
