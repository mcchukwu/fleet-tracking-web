import { useEffect, type ReactNode } from "react";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  redirect,
  useRouter,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "../api/types";
import { can, type Capability } from "../auth/roles";
import { ensureSession } from "../auth/session";
import { ErrorBoundary } from "../errors/ErrorBoundary";
import { ErrorState } from "../errors/ErrorState";
import { normalize } from "../errors/normalize";
import { recordError } from "../errors/report";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { LoginPage } from "../features/login/components/LoginPage";
import { AlertsPage } from "../features/alerts/components/AlertsPage";
import { MapPage } from "../features/map/components/MapPage";
import { PlaybackPage } from "../features/playback/components/PlaybackPage";
import { AppShell } from "../features/shell/components/AppShell";
import { SessionExpiryDialog } from "../features/shell/components/SessionExpiryDialog";
import { ShellSkeleton } from "../features/shell/components/ShellSkeleton";
import { StyleGuidePage } from "../features/styleguide/StyleGuidePage";
import { TripsPage } from "../features/trips/components/TripsPage";
import { ForbiddenState } from "../ui/StatePanel";
import { NotFound } from "./NotFound";
import { PlaceholderPage } from "./PlaceholderPage";
import { safeRedirect } from "./redirect";
import {
  alertsSearchSchema,
  auditSearchSchema,
  driversSearchSchema,
  geofencesSearchSchema,
  loginSearchSchema,
  mapSearchSchema,
  playbackSearchSchema,
  reportsSearchSchema,
  tripsSearchSchema,
} from "./search";

export interface RouterContext {
  queryClient: QueryClient;
}

async function requireUser(context: RouterContext, href: string): Promise<User> {
  const user = await ensureSession(context.queryClient);
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: href } });
  }
  return user;
}

function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const route = typeof window === "undefined" ? "/" : window.location.pathname;
  const normalized = normalize(error, { route });

  useEffect(() => {
    recordError(normalize(error, { route }));
  }, [error, route]);

  const retry = () => {
    reset();
    void router.invalidate();
  };
  const action =
    normalized.kind === "unauthenticated"
      ? () => {
          const redirect = `${window.location.pathname}${window.location.search}`;
          void router.navigate({ to: "/login", search: { redirect } });
        }
      : normalized.kind === "offline"
        ? retry
        : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <h1 className="sr-only">Something went wrong</h1>
      <ErrorState error={normalized} blocking onRetry={retry} onAction={action} />
    </main>
  );
}

function requireCapability(user: User, capability: Capability): void {
  if (!can(user.role, capability)) {
    throw redirect({ to: "/forbidden" });
  }
}

function RouteBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <ErrorBoundary level="route" resetKeys={[pathname]}>
      {children}
    </ErrorBoundary>
  );
}

function RootLayout() {
  return (
    <>
      <RouteBoundary>
        <Outlet />
      </RouteBoundary>
      <SessionExpiryDialog />
    </>
  );
}

function ForbiddenPage() {
  useDocumentTitle("Forbidden");
  return (
    <div className="mx-auto flex max-w-content flex-col items-center px-4 py-10 text-text sm:px-6">
      <h1 className="sr-only">Forbidden</h1>
      <ForbiddenState
        action={
          <Link
            to="/map"
            className="inline-flex h-touch items-center text-sm font-medium text-accent-fg underline-offset-4 hover:underline md:h-control-md"
          >
            Back to the map
          </Link>
        }
      />
    </div>
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/map" });
  },
});

const styleguideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/styleguide",
  component: StyleGuidePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const user = await ensureSession(context.queryClient);
    if (user) throw redirect({ to: safeRedirect(search.redirect) });
  },
  component: LoginPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  component: AppShell,
  pendingComponent: ShellSkeleton,
  pendingMs: 0,
  beforeLoad: async ({ context, location }) => ({
    user: await requireUser(context, location.href),
  }),
});

function placeholder(title: string, description: string) {
  return function Placeholder() {
    return <PlaceholderPage title={title} description={description} />;
  };
}

const mapRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/map",
  validateSearch: mapSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: MapPage,
});

const alertsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/alerts",
  validateSearch: alertsSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: AlertsPage,
});

const tripsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/trips",
  validateSearch: tripsSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: TripsPage,
});

const driversRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/drivers",
  validateSearch: driversSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: placeholder("Drivers", "The drivers table ships in Slice 7."),
});

const geofencesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/geofences",
  validateSearch: geofencesSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: placeholder("Geofences", "The geofence editor ships in Slice 8."),
});

const importRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/import",
  beforeLoad: ({ context }) => requireCapability(context.user, "mutate"),
  component: placeholder("Import", "The vehicle import ships in Slice 9."),
});

const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/reports",
  validateSearch: reportsSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: placeholder("Reports", "The reports screen ships in Slice 10."),
});

const systemRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/system",
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: placeholder("System health", "The system health screen ships in Slice 11."),
});

const auditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/audit",
  validateSearch: auditSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "audit"),
  component: placeholder("Audit", "The audit log ships in Slice 12."),
});

const playbackRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/playback",
  validateSearch: playbackSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: PlaybackPage,
});

const forbiddenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/forbidden",
  component: ForbiddenPage,
});

const devRoutes = import.meta.env.DEV
  ? [
      createRoute({
        getParentRoute: () => appRoute,
        path: "/dev/faults",
        component: lazyRouteComponent(() => import("../dev/FaultLab"), "FaultLab"),
      }),
    ]
  : [];

const routeTree = rootRoute.addChildren([
  indexRoute,
  styleguideRoute,
  loginRoute,
  appRoute.addChildren([
    mapRoute,
    alertsRoute,
    tripsRoute,
    driversRoute,
    geofencesRoute,
    importRoute,
    reportsRoute,
    systemRoute,
    auditRoute,
    playbackRoute,
    forbiddenRoute,
    ...devRoutes,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultErrorComponent: RouteError,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
