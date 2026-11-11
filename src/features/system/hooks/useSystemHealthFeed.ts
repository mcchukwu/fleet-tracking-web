import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { SystemHealth } from "../../../api/schemas";
import { useSystemHealth } from "../../../api/hooks/system";
import { queryKeys } from "../../../api/keys";
import { useDocumentVisible } from "../../../lib/useDocumentVisible";
import { useConnection } from "../../../stores/connection";
import { SYSTEM_HEALTH_POLL_MS } from "../lib/constants";
import { useHealthTrend } from "./useHealthTrend";
import type { HealthTrend } from "../lib/health";

export interface SystemHealthFeed {
  data: SystemHealth | undefined;
  dataUpdatedAt: number;
  isPending: boolean;
  isFetching: boolean;
  error: Error | null;
  cancelled: boolean;
  online: boolean;
  trend: HealthTrend;
  refetch: () => void;
  cancel: () => void;
}

export function useSystemHealthFeed(): SystemHealthFeed {
  const queryClient = useQueryClient();
  const { network } = useConnection();
  const online = network === "online";
  const visible = useDocumentVisible();
  const [mountedAt] = useState(() => Date.now());
  const [cancelled, setCancelled] = useState(false);
  const wasVisible = useRef(visible);

  const query = useSystemHealth({
    enabled: online,
    refetchInterval: online && visible ? SYSTEM_HEALTH_POLL_MS : false,
  });
  const { refetch } = query;
  const dataUpdatedAt = query.dataUpdatedAt;

  useEffect(() => {
    if (visible && !wasVisible.current && online) void refetch();
    wasVisible.current = visible;
  }, [visible, online, refetch]);

  const lastUpdated = useRef(dataUpdatedAt);
  useEffect(() => {
    if (dataUpdatedAt > lastUpdated.current) {
      lastUpdated.current = dataUpdatedAt;
      setCancelled(false);
    }
  }, [dataUpdatedAt]);

  const trend = useHealthTrend({ data: query.data, dataUpdatedAt, mountedAt });

  return {
    data: query.data,
    dataUpdatedAt,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.error ?? null,
    cancelled,
    online,
    trend,
    refetch: () => {
      setCancelled(false);
      void refetch();
    },
    cancel: () => {
      setCancelled(true);
      void queryClient.cancelQueries({ queryKey: queryKeys.systemHealth });
    },
  };
}
