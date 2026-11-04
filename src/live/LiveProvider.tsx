import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { liveSnapshotQueryOptions, useLiveSnapshot } from "../api/hooks/vehicles";
import { api } from "../api/instance";
import { LiveSocketManager, type SocketState } from "../api/live";
import type { LiveMessage } from "../api/schemas";
import { useAuthStore } from "../auth/store";
import { useConnectionStore } from "../stores/connection";
import { useLiveStore } from "../stores/live";
import { useLiveRegion } from "../ui/LiveRegion";
import { useToast } from "../ui/Toast";
import { alertBatchSummary, normalizeAlertFrame } from "./alertFrame";
import { createFrameBatcher, type FrameBatcher } from "./batcher";

const ALERT_DEDUPE_MS = 60_000;
const ALERT_INVALIDATE_MS = 1_000;

function isPosition(frame: LiveMessage): frame is Extract<LiveMessage, { type: "position" }> {
  return frame.type === "position";
}

function isAlert(frame: LiveMessage): frame is Extract<LiveMessage, { type: "alert" }> {
  return frame.type === "alert";
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { announce } = useLiveRegion();
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const snapshot = useLiveSnapshot().data;

  const batcherRef = useRef<FrameBatcher<LiveMessage> | null>(null);
  const activeRef = useRef(false);
  const seenAlerts = useRef(new Map<string, number>());
  const alertSequence = useRef(0);
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousUserId = useRef<string | null>(null);
  const announceRef = useRef(announce);
  const toastRef = useRef(toast);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    announceRef.current = announce;
    toastRef.current = toast;
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (snapshot) useLiveStore.getState().applySnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    if (previousUserId.current !== null && previousUserId.current !== userId) {
      useLiveStore.getState().reset();
    }
    previousUserId.current = userId;

    activeRef.current = true;
    useConnectionStore.getState().setSocket("down");

    const invalidateAlertsSoon = () => {
      if (alertTimer.current) return;
      alertTimer.current = setTimeout(() => {
        alertTimer.current = null;
        void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      }, ALERT_INVALIDATE_MS);
    };

    const handleBatch = (frames: LiveMessage[]) => {
      if (!activeRef.current) return;

      const positions = frames.filter(isPosition);
      if (positions.length > 0) {
        const newest = useLiveStore.getState().applyFrames(positions);
        if (newest !== null) useConnectionStore.getState().markData(newest);
      }

      const now = Date.now();
      for (const [key, at] of seenAlerts.current) {
        if (now - at > ALERT_DEDUPE_MS) seenAlerts.current.delete(key);
      }

      const alerts = frames
        .filter(isAlert)
        .map((frame) => normalizeAlertFrame(frame))
        .filter((alert) => {
          if (seenAlerts.current.has(alert.key)) return false;
          seenAlerts.current.set(alert.key, now);
          return true;
        });

      if (alerts.length === 0) return;

      for (const alert of alerts) useLiveStore.getState().markAlert(alert.vehicleKey);
      const summary = alertBatchSummary(alerts);
      toastRef.current({
        title: summary.title,
        description: summary.description,
        tone: "info",
        key: summary.key,
        action: {
          label: "View",
          onClick: () => {
            void navigateRef.current({ to: "/alerts", search: { status: "open" } });
          },
        },
      });
      announceRef.current(`${summary.title}. ${summary.description}`);
      invalidateAlertsSoon();
    };

    const batcher = createFrameBatcher<LiveMessage>(handleBatch, {
      keyOf: (frame) =>
        frame.type === "position" ? `position:${frame.vehicle_id}` : `alert:${alertSequence.current++}`,
    });
    batcherRef.current = batcher;

    const manager = new LiveSocketManager({
      createSocket: () => new WebSocket(api.liveUrl()),
      onFrame: (frame) => batcher.push(frame),
      resync: async () => {
        const data = await queryClient.fetchQuery({
          ...liveSnapshotQueryOptions(),
          retry: false,
          staleTime: 0,
        });
        useLiveStore.getState().applySnapshot(data);
      },
      onState: (state: SocketState) => useConnectionStore.getState().setSocket(state),
      isOnline: () => navigator.onLine,
    });
    manager.start();

    return () => {
      activeRef.current = false;
      manager.stop();
      if (alertTimer.current) {
        clearTimeout(alertTimer.current);
        alertTimer.current = null;
      }
      batcher.stop();
      batcherRef.current = null;
    };
  }, [queryClient, status, userId]);

  useEffect(() => {
    if (status === "anonymous") {
      seenAlerts.current.clear();
    }
  }, [status]);

  return <>{children}</>;
}
