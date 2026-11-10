import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../../auth/store";
import { useErrorStorm } from "../../../errors/global";
import { formatClockTime } from "../../../lib/format";
import {
  useConnection,
  useConnectionStore,
  type SocketState,
} from "../../../stores/connection";
import { Banner } from "../../../ui/Banner";
import { highestPriorityBanner, type BannerKind } from "./bannerPriority";

function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const onUpdate = () => setAvailable(true);
    window.addEventListener("fleet:update-available", onUpdate);
    return () => window.removeEventListener("fleet:update-available", onUpdate);
  }, []);
  return available;
}

export const RECONNECT_BANNER_DELAY_MS = 10_000;
export const RECONNECT_TERMINAL_MS = 60_000;

type ReconnectPhase = "hidden" | "reconnecting" | "unavailable";

function reconnectPhase(
  socket: SocketState,
  socketDownAt: number | null,
  now: number,
): ReconnectPhase {
  if (socket !== "reconnecting" || socketDownAt === null) return "hidden";
  const elapsed = now - socketDownAt;
  if (elapsed >= RECONNECT_TERMINAL_MS) return "unavailable";
  if (elapsed >= RECONNECT_BANNER_DELAY_MS) return "reconnecting";
  return "hidden";
}

function useReconnectPhase(
  socket: SocketState,
  socketDownAt: number | null,
): { phase: ReconnectPhase; hide: () => void } {
  const [phase, setPhase] = useState<ReconnectPhase>("hidden");

  useEffect(() => {
    const refresh = () =>
      setPhase(reconnectPhase(socket, socketDownAt, Date.now()));
    const timers: Array<ReturnType<typeof setTimeout>> = [
      setTimeout(refresh, 0),
    ];

    if (socket === "reconnecting" && socketDownAt !== null) {
      const elapsed = Date.now() - socketDownAt;
      if (elapsed < RECONNECT_BANNER_DELAY_MS) {
        timers.push(
          setTimeout(
            () => setPhase("reconnecting"),
            RECONNECT_BANNER_DELAY_MS - elapsed,
          ),
        );
      }
      if (elapsed < RECONNECT_TERMINAL_MS) {
        timers.push(
          setTimeout(
            () => setPhase("unavailable"),
            RECONNECT_TERMINAL_MS - elapsed,
          ),
        );
      }
    }

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [socket, socketDownAt]);

  return { phase, hide: () => setPhase("hidden") };
}

export function GlobalBanners() {
  const { network, socket, socketDownAt, lastDataAt } = useConnection();
  const { phase, hide: hideReconnect } = useReconnectPhase(
    socket,
    socketDownAt,
  );
  const retryLive = useConnectionStore((state) => state.retryLive);
  const storm = useErrorStorm();
  const update = useUpdateAvailable();
  const expired = useAuthStore((state) => state.status === "expired");
  const navigate = useNavigate();

  const present: BannerKind[] = [];
  if (expired) present.push("session-expired");
  if (network === "offline") present.push("offline");
  if (socket === "reconnecting" && phase === "unavailable")
    present.push("unavailable");
  if (storm) present.push("storm");
  if (socket === "reconnecting" && phase === "reconnecting")
    present.push("reconnecting");
  if (update) present.push("update");
  const kind = highestPriorityBanner(present);

  let banner = null;
  if (kind === "session-expired") {
    banner = (
      <Banner tone="danger" message="Your session expired. Sign in again." />
    );
  } else if (kind === "offline") {
    const time = formatClockTime(lastDataAt);
    banner = (
      <Banner
        tone="neutral"
        message={
          lastDataAt === null
            ? "You're offline. Changes are disabled."
            : `You're offline. Showing data from ${time}. Changes are disabled.`
        }
      />
    );
  } else if (kind === "unavailable") {
    banner = (
      <Banner
        tone="warning"
        message={
          lastDataAt === null
            ? "Live updates are unavailable."
            : `Live updates are unavailable. Showing data from ${formatClockTime(lastDataAt)}.`
        }
        action={{
          label: "Retry now",
          onClick: () => {
            hideReconnect();
            retryLive();
          },
        }}
      />
    );
  } else if (kind === "storm") {
    banner = (
      <Banner
        tone="warning"
        message="We're having trouble reaching the server. Retrying…"
        action={{
          label: "Open System",
          onClick: () => void navigate({ to: "/system" }),
        }}
      />
    );
  } else if (kind === "reconnecting") {
    banner = <Banner tone="warning" message="Reconnecting to live updates…" />;
  } else if (kind === "update") {
    banner = (
      <Banner
        tone="info"
        message="A new version is available."
        action={{ label: "Reload", onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <div
      data-testid="banner-region"
      data-visible={kind === null ? "false" : "true"}
      data-banner-kind={kind ?? undefined}
      className="banner-region shrink-0"
    >
      <div>{banner}</div>
    </div>
  );
}
