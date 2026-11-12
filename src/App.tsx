import { useEffect, useMemo } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "./auth/AuthProvider";
import { createAppRouter } from "./app/router";
import { installDebugHook } from "./dev/install";
import { ErrorBoundary } from "./errors/ErrorBoundary";
import { StorageNotice } from "./features/shell/components/StorageNotice";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ToastProvider } from "./ui/Toast";
import { TooltipProvider } from "./ui/Tooltip";

export interface AppProps {
  queryClient: QueryClient;
}

export function App({ queryClient }: AppProps) {
  useEffect(() => installDebugHook(), []);
  const router = useMemo(() => createAppRouter(queryClient), [queryClient]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <ToastProvider>
              <StorageNotice />
              <ErrorBoundary level="app">
                <RouterProvider router={router} />
              </ErrorBoundary>
            </ToastProvider>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
