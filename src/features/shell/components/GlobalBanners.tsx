import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useErrorStorm } from "../../../errors/global";
import { formatClockTime } from "../../../lib/format";
import { useConnection, type SocketState } from "../../../stores/connection";
import { Banner } from "../../../ui/Banner";

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

function useReconnectVisible(socket: SocketState, socketDownAt: number | null): boolean {
  const [dueAt, setDueAt] = useState<number | null>(null);

  useEffect(() => {
    if (socket !== "reconnecting" || socketDownAt === null) return;
    const remaining = RECONNECT_BANNER_DELAY_MS - (Date.now() - socketDownAt);
    const timer = setTimeout(() => setDueAt(socketDownAt), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [socket, socketDownAt]);

  return socket === "reconnecting" && socketDownAt !== null && dueAt === socketDownAt;
}

export function GlobalBanners() {
  const { network, socket, socketDownAt, lastDataAt } = useConnection();
  const reconnecting = useReconnectVisible(socket, socketDownAt);
  const storm = useErrorStorm();
  const update = useUpdateAvailable();
  const navigate = useNavigate();

  if (network === "offline") {
    const time = formatClockTime(lastDataAt);
    return (
      <Banner
        tone="neutral"
        message={
          lastDataAt === null
            ? "You're offline. Changes are disabled."
            : `You're offline. Showing data from ${time}. Changes are disabled.`
        }
      />
    );
  }

  if (socket === "reconnecting" && reconnecting) {
    return <Banner tone="warning" message="Reconnecting to live updates…" />;
  }

  if (storm) {
    return (
      <Banner
        tone="warning"
        message="We're having trouble reaching the server. Retrying…"
        action={{ label: "Open System", onClick: () => void navigate({ to: "/system" }) }}
      />
    );
  }

  if (update) {
    return (
      <Banner
        tone="info"
        message="A new version is available."
        action={{ label: "Reload", onClick: () => window.location.reload() }}
      />
    );
  }

  return null;
}
