import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "./auth/AuthProvider";
import { createAppRouter } from "./app/router";
import { installDebugHook } from "./dev/install";
import { ErrorBoundary } from "./errors/ErrorBoundary";
import { createQueryClient } from "./errors/global";
import { ThemeProvider } from "./theme/ThemeProvider";

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

export function App() {
  useEffect(() => installDebugHook(), []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ErrorBoundary level="app">
            <RouterProvider router={router} />
          </ErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
