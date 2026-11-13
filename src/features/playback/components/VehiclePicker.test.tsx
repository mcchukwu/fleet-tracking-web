import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectionStore } from "../../../stores/connection";
import { VehiclePicker } from "./VehiclePicker";

const mocks = vi.hoisted(() => ({
  snapshot: {
    data: [] as Array<Record<string, unknown>> | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useLiveSnapshot: () => mocks.snapshot,
}));

const vehicles = [
  {
    id: "4324a768-9b14-4223-a299-eb8da4d8d309",
    external_id: "demo-imei-0001",
    plate: "LSD-100-AA",
    depot: "Lekki Depot",
    online: true,
  },
  {
    id: "6c69032e-b802-447e-8f7a-ad8c0ddc2359",
    external_id: "demo-imei-0002",
    plate: "LSD-101-AA",
    depot: "Apapa Depot",
    online: true,
  },
];

beforeEach(() => {
  mocks.snapshot.data = vehicles;
  mocks.snapshot.isLoading = false;
  mocks.snapshot.isError = false;
  mocks.snapshot.error = null;
  mocks.snapshot.refetch.mockReset();
  useConnectionStore.setState({ network: "online" });
});

describe("VehiclePicker", () => {
  it("searches plate and IMEI and renders mono plates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VehiclePicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Vehicle" }));
    const dialog = screen.getByRole("dialog", { name: "Vehicle" });
    const search = within(dialog).getByRole("combobox", { name: "Vehicle" });
    expect(within(dialog).getAllByRole("option")).toHaveLength(2);
    expect(within(dialog).getAllByRole("option")[0]?.querySelector("span")).toHaveClass(
      "font-mono",
    );

    await user.type(search, "imei-0002");
    expect(within(dialog).getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("6c69032e-b802-447e-8f7a-ad8c0ddc2359");
  });

  it("shows the skeleton after the delay when nothing is cached", async () => {
    mocks.snapshot.data = undefined;
    mocks.snapshot.isLoading = true;
    render(<VehiclePicker value={null} onChange={() => undefined} />);
    await waitFor(() => expect(screen.getByLabelText("Loading vehicles")).toBeInTheDocument());
  });

  it("shows an error with Retry when the snapshot fails online", async () => {
    mocks.snapshot.data = undefined;
    mocks.snapshot.isError = true;
    mocks.snapshot.error = {
      kind: "network",
      retryable: true,
      outcome: "failed",
      context: { route: "/playback" },
      at: 0,
    };
    render(<VehiclePicker value={null} onChange={() => undefined} />);
    expect(screen.getByText("Can't reach the server")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.snapshot.refetch).toHaveBeenCalled();
  });

  it("shows the offline card when nothing is cached", () => {
    mocks.snapshot.data = undefined;
    useConnectionStore.setState({ network: "offline" });
    render(<VehiclePicker value={null} onChange={() => undefined} />);
    expect(screen.getByText("Not available offline")).toBeVisible();
    expect(screen.queryByText("Can't reach the server")).not.toBeInTheDocument();
  });

  it("distinguishes an empty tenant from no matches", async () => {
    mocks.snapshot.data = [];
    render(<VehiclePicker value={null} onChange={() => undefined} />);
    expect(screen.getByText("No vehicles yet")).toBeVisible();
    expect(screen.getByText("Vehicles appear here when they report.")).toBeVisible();
  });

  it("says no matches when the search misses", async () => {
    const user = userEvent.setup();
    render(<VehiclePicker value={null} onChange={() => undefined} />);
    await user.click(screen.getByRole("combobox", { name: "Vehicle" }));
    const dialog = screen.getByRole("dialog", { name: "Vehicle" });
    await user.type(within(dialog).getByRole("combobox", { name: "Vehicle" }), "zzz");
    expect(within(dialog).getByText("No vehicles match")).toBeVisible();
  });
});
