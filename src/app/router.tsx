import type { ReactNode } from "react";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
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
import { StyleGuidePage } from "../features/styleguide/StyleGuidePage";
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

async function requireUser(_context: RouterContext, href: string): Promise<User> {
  const user = await ensureSession();
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: href } });
  }
  return user;
}

function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const normalized = normalize(error, {
    route: typeof window === "undefined" ? "/" : window.location.pathname,
  });
  const retry = () => {
    reset();
    void router.invalidate();
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <ErrorState error={normalized} blocking onRetry={retry} onAction={retry} />
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
    <RouteBoundary>
      <Outlet />
    </RouteBoundary>
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
    throw redirect({ to: "/styleguide" });
  },
});

const styleguideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/styleguide",
  component: StyleGuidePage,
});

function placeholder(title: string, description: string) {
  return function Placeholder() {
    return <PlaceholderPage title={title} description={description} />;
  };
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ search }) => {
    const user = await ensureSession();
    if (user) throw redirect({ to: safeRedirect(search.redirect) });
  },
  component: placeholder("Sign in", "The login screen ships in Slice 1."),
});

const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map",
  validateSearch: mapSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "read");
  },
  component: placeholder("Map", "The live map ships in Slice 2."),
});

const alertsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/alerts",
  validateSearch: alertsSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "read");
  },
  component: placeholder("Alerts", "The alerts list ships in Slice 4."),
});

const tripsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trips",
  validateSearch: tripsSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "read");
  },
  component: placeholder("Trips", "The trips table ships in Slice 6."),
});

const driversRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/drivers",
  validateSearch: driversSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "read");
  },
  component: placeholder("Drivers", "The drivers table ships in Slice 7."),
});

const geofencesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/geofences",
  validateSearch: geofencesSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "read");
  },
  component: placeholder("Geofences", "The geofence editor ships in Slice 8."),
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "mutate");
  },
  component: placeholder("Import", "The vehicle import ships in Slice 9."),
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  validateSearch: reportsSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "read");
  },
  component: placeholder("Reports", "The reports screen ships in Slice 10."),
});

const systemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/system",
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "read");
  },
  component: placeholder("System health", "The system health screen ships in Slice 11."),
});

const auditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/audit",
  validateSearch: auditSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "audit");
  },
  component: placeholder("Audit", "The audit log ships in Slice 12."),
});

const playbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/playback",
  validateSearch: playbackSearchSchema,
  beforeLoad: async ({ context, location }) => {
    const user = await requireUser(context, location.href);
    requireCapability(user, "read");
  },
  component: placeholder("Playback", "Playback ships in Slice 5."),
});

const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forbidden",
  component: function Forbidden() {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg text-text">
        <ForbiddenState />
        <Link to="/map" className="text-sm font-medium text-accent-fg underline-offset-4 hover:underline">
          Back to the map
        </Link>
      </main>
    );
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  styleguideRoute,
  loginRoute,
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
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
