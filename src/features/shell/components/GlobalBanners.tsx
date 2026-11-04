import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useErrorStorm } from "../../../errors/global";
import { formatClockTime } from "../../../lib/format";
import { useConnection } from "../../../stores/connection";
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

export function GlobalBanners() {
  const { network, socket, lastDataAt } = useConnection();
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

  if (socket === "reconnecting") {
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
