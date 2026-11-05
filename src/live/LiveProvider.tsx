import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { liveSnapshotQueryOptions, useLiveSnapshot } from "../api/hooks/vehicles";
import { api } from "../api/instance";
import { LiveSocketManager, type SocketState } from "../api/live";
import { liveMessageSchema, type LiveMessage, type PositionMessage } from "../api/schemas";
import { useAuthStore } from "../auth/store";
import { useConnectionStore } from "../stores/connection";
import { useLiveStore } from "../stores/live";
import { useToast } from "../ui/Toast";
import {
  alertBatchSummary,
  alertWindowDelay,
  normalizeAlertFrame,
  type NormalizedAlertFrame,
} from "./alertFrame";
import { createFrameBatcher } from "./batcher";

const ALERT_DEDUPE_MS = 60_000;
const ALERT_INVALIDATE_MS = 1_000;

function isPosition(frame: LiveMessage): frame is PositionMessage {
  return frame.type === "position";
}

function isAlert(frame: LiveMessage): frame is Extract<LiveMessage, { type: "alert" }> {
  return frame.type === "alert";
}

/** Parses and validates raw frames inside the batch, never per socket message. */
function parseFrames(rawFrames: readonly string[]): LiveMessage[] {
  const frames: LiveMessage[] = [];
  for (const raw of rawFrames) {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      continue;
    }
    const result = liveMessageSchema.safeParse(payload);
    if (result.success) frames.push(result.data);
  }
  return frames;
}

function coalescePositions(frames: readonly LiveMessage[]): PositionMessage[] {
  const newest = new Map<string, PositionMessage>();
  for (const frame of frames) {
    if (!isPosition(frame)) continue;
    const previous = newest.get(frame.vehicle_id);
    if (!previous || Date.parse(frame.recorded_at) > Date.parse(previous.recorded_at)) {
      newest.set(frame.vehicle_id, frame);
    }
  }
  return [...newest.values()];
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authenticated = status === "authenticated";
  const snapshot = useLiveSnapshot(authenticated).data;

  const activeRef = useRef(false);
  const seenAlerts = useRef(new Map<string, number>());
  const alertWindowSequence = useRef(0);
  const previousUserId = useRef<string | null>(null);
  const toastRef = useRef(toast);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    toastRef.current = toast;
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!snapshot) return;
    useLiveStore.getState().applySnapshot(snapshot);

    // Seed the stream clock from the snapshot until the first frame arrives.
    if (useConnectionStore.getState().lastDataAt === null) {
      const newest = snapshot.reduce<number | null>((latest, vehicle) => {
        if (!vehicle.recorded_at) return latest;
        const at = Date.parse(vehicle.recorded_at);
        if (Number.isNaN(at)) return latest;
        return latest === null || at > latest ? at : latest;
      }, null);
      if (newest !== null) useConnectionStore.getState().markData(newest);
    }
  }, [snapshot]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    if (previousUserId.current !== null && previousUserId.current !== userId) {
      useLiveStore.getState().reset();
      seenAlerts.current.clear();
    }
    previousUserId.current = userId;

    activeRef.current = true;
    useConnectionStore.getState().setSocket("down");

    let alertWindowTimer: ReturnType<typeof setTimeout> | null = null;
    let invalidationTimer: ReturnType<typeof setTimeout> | null = null;
    let lastAlertFlushAt: number | null = null;
    const pendingAlerts = new Map<string, NormalizedAlertFrame>();

    const invalidateAlertsSoon = () => {
      if (invalidationTimer) return;
      invalidationTimer = setTimeout(() => {
        invalidationTimer = null;
        void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      }, ALERT_INVALIDATE_MS);
    };

    const flushAlertWindow = () => {
      alertWindowTimer = null;
      const alerts = [...pendingAlerts.values()];
      pendingAlerts.clear();
      if (!activeRef.current || alerts.length === 0) return;

      lastAlertFlushAt = Date.now();
      const summary = alertBatchSummary(alerts);
      const key =
        summary.count > 1
          ? `alert-batch:${alertWindowSequence.current++}`
          : summary.key;
      toastRef.current({
        title: summary.title,
        description: summary.description,
        tone: "info",
        assertive: summary.assertive,
        key,
        action: {
          label: "View",
          onClick: () => {
            void navigateRef.current({ to: "/alerts", search: { status: "open" } });
          },
        },
      });
      invalidateAlertsSoon();
    };

    const handleBatch = (rawFrames: string[]) => {
      if (!activeRef.current) return;

      const frames = parseFrames(rawFrames);
      if (frames.length === 0) return;

      const positions = coalescePositions(frames);
      if (positions.length > 0) {
        const newest = useLiveStore.getState().applyFrames(positions);
        if (newest !== null) useConnectionStore.getState().markData(newest);
      }

      const now = Date.now();
      for (const [key, at] of seenAlerts.current) {
        if (now - at > ALERT_DEDUPE_MS) seenAlerts.current.delete(key);
      }

      let queued = false;
      for (const frame of frames) {
        if (!isAlert(frame)) continue;
        const alert = normalizeAlertFrame(frame);
        if (seenAlerts.current.has(alert.key)) continue;
        seenAlerts.current.set(alert.key, now);
        useLiveStore.getState().markAlert(alert.vehicleKey);
        pendingAlerts.set(alert.key, alert);
        queued = true;
      }

      if (queued && alertWindowTimer === null) {
        alertWindowTimer = setTimeout(
          flushAlertWindow,
          alertWindowDelay(lastAlertFlushAt, Date.now()),
        );
      }
    };

    const batcher = createFrameBatcher<string>(handleBatch);

    const manager = new LiveSocketManager({
      createSocket: () => new WebSocket(api.liveUrl()),
      onFrame: (raw) => batcher.push(raw),
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
      if (invalidationTimer) {
        clearTimeout(invalidationTimer);
        invalidationTimer = null;
      }
      if (alertWindowTimer) {
        clearTimeout(alertWindowTimer);
        alertWindowTimer = null;
      }
      pendingAlerts.clear();
      batcher.stop();
    };
  }, [queryClient, status, userId]);

  useEffect(() => {
    if (status === "anonymous") {
      seenAlerts.current.clear();
    }
  }, [status]);

  return <>{children}</>;
}
