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
import { AppShell } from "../features/shell/components/AppShell";
import { SessionExpiryDialog } from "../features/shell/components/SessionExpiryDialog";
import { ShellSkeleton } from "../features/shell/components/ShellSkeleton";
import { PageFrame } from "../ui/PageFrame";
import { ForbiddenState } from "../ui/StatePanel";
import { NotFound } from "./NotFound";
import { safeRedirect } from "./redirect";
import { RouteLoading } from "./RouteLoading";

const MapPage = lazyRouteComponent(() => import("../features/map/components/MapPage"), "MapPage");
const AlertsPage = lazyRouteComponent(
  () => import("../features/alerts/components/AlertsPage"),
  "AlertsPage",
);
const TripsPage = lazyRouteComponent(
  () => import("../features/trips/components/TripsPage"),
  "TripsPage",
);
const DriversPage = lazyRouteComponent(
  () => import("../features/drivers/components/DriversPage"),
  "DriversPage",
);
const GeofencesPage = lazyRouteComponent(
  () => import("../features/geofences/components/GeofencesPage"),
  "GeofencesPage",
);
const ImportPage = lazyRouteComponent(
  () => import("../features/import/components/ImportPage"),
  "ImportPage",
);
const ReportsPage = lazyRouteComponent(
  () => import("../features/reports/components/ReportsPage"),
  "ReportsPage",
);
const SystemPage = lazyRouteComponent(
  () => import("../features/system/components/SystemPage"),
  "SystemPage",
);
const AuditPage = lazyRouteComponent(
  () => import("../features/audit/components/AuditPage"),
  "AuditPage",
);
const PlaybackPage = lazyRouteComponent(
  () => import("../features/playback/components/PlaybackPage"),
  "PlaybackPage",
);
const StyleGuidePage = lazyRouteComponent(
  () => import("../features/styleguide/StyleGuidePage"),
  "StyleGuidePage",
);
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
    <div className="bg-bg text-text h-dvh">
      <PageFrame layout="scroll" align="center" contentClassName="px-4 pt-6 sm:px-6">
        <h1 className="sr-only">Something went wrong</h1>
        <ErrorState error={normalized} blocking onRetry={retry} onAction={action} />
      </PageFrame>
    </div>
  );
}

function requireCapability(user: User, capability: Capability): void {
  if (!can(user.role, capability)) {
    throw redirect({ to: "/forbidden" });
  }
}

function RouteBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
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
    <PageFrame layout="scroll" align="center" contentClassName="items-center px-4 pt-10 sm:px-6">
      <h1 className="sr-only">Forbidden</h1>
      <ForbiddenState
        action={
          <Link
            to="/map"
            className="h-touch text-accent-fg md:h-control-md inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Back to the map
          </Link>
        }
      />
    </PageFrame>
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
    throw redirect({ to: "/map", search: true });
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
  component: DriversPage,
});

const geofencesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/geofences",
  validateSearch: geofencesSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: GeofencesPage,
});

const importRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/import",
  beforeLoad: ({ context }) => requireCapability(context.user, "mutate"),
  component: ImportPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/reports",
  validateSearch: reportsSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: ReportsPage,
});

const systemRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/system",
  beforeLoad: ({ context }) => requireCapability(context.user, "read"),
  component: SystemPage,
});

const auditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/audit",
  validateSearch: auditSearchSchema,
  beforeLoad: ({ context }) => requireCapability(context.user, "audit"),
  component: AuditPage,
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
      createRoute({
        getParentRoute: () => appRoute,
        path: "/dev/layers",
        component: lazyRouteComponent(() => import("../dev/LayerStack"), "LayerStack"),
      }),
      createRoute({
        getParentRoute: () => appRoute,
        path: "/dev/combobox",
        component: lazyRouteComponent(() => import("../dev/ComboboxLab"), "ComboboxLab"),
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
    defaultPendingComponent: RouteLoading,
    defaultPendingMs: 200,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
