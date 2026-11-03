import { useState, type ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Truck,
  WifiOff,
} from "lucide-react";
import { AccentPicker } from "../../theme/AccentPicker";
import { ThemeToggle } from "../../theme/ThemeToggle";
import {
  AlertStatusBadge,
  Badge,
  ConnectionIndicator,
  SeverityBadge,
  StatusPill,
  TripStatusBadge,
  type AlertStatus,
  type Severity,
  type TripStatus,
} from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { Drawer } from "../../ui/Drawer";
import { IconButton } from "../../ui/IconButton";
import { Input } from "../../ui/Input";
import { SearchInput } from "../../ui/SearchInput";
import { Select } from "../../ui/Select";
import { Stat } from "../../ui/Stat";
import { EmptyState, ForbiddenState, LoadingBar, LoadingState, Skeleton } from "../../ui/StatePanel";
import { ErrorState } from "../../errors/ErrorState";
import type { AppError } from "../../errors/types";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Spinner } from "../../ui/Spinner";
import { TBody, TD, TH, THead, TR, Table } from "../../ui/Table";
import { Textarea } from "../../ui/Textarea";

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-12 space-y-4">
      <div className="max-w-prose space-y-1">
        <h2 className="text-md font-medium text-text">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

const vehicles = [
  { plate: "LSD-100-AA", driver: "Adebayo Okafor", speed: 62, status: "moving" as const },
  { plate: "LSD-101-AA", driver: "Chinedu Musa", speed: 0, status: "idle" as const },
  { plate: "LSD-102-AA", driver: "Musa Adeyemi", speed: 0, status: "offline" as const },
  { plate: "LSD-103-AA", driver: "Tunde Bello", speed: 74, status: "alert" as const },
];

const statuses = ["moving", "idle", "offline", "alert"] as const;
const severities: Severity[] = ["low", "medium", "high", "critical"];
const alertStatuses: AlertStatus[] = ["open", "acked", "closed"];
const tripStatuses: TripStatus[] = ["planned", "assigned", "active", "completed", "cancelled"];

const sampleError: AppError = {
  kind: "network",
  retryable: true,
  outcome: "failed",
  context: { route: "/styleguide", action: "load the vehicle list" },
  at: 0,
};

type TableState = "default" | "pending" | "loading" | "empty" | "error";

const tableStates: Array<{ id: TableState; label: string }> = [
  { id: "default", label: "Rows" },
  { id: "pending", label: "Pending" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Empty" },
  { id: "error", label: "Error" },
];

function VehicleTable({ pending = false }: { pending?: boolean }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Vehicle</TH>
          <TH>Driver</TH>
          <TH numeric>Speed</TH>
          <TH>Status</TH>
          <TH className="w-12">
            <span className="sr-only">Actions</span>
          </TH>
        </TR>
      </THead>
      <TBody>
        {vehicles.map((vehicle, index) => {
          const isPending = pending && index === 0;
          return (
            <TR
              key={vehicle.plate}
              selected={index === 0}
              className={isPending ? "opacity-60" : undefined}
              aria-busy={isPending || undefined}
            >
              <TD>
                <span className="font-mono text-sm text-text">{vehicle.plate}</span>
              </TD>
              <TD>{vehicle.driver}</TD>
              <TD numeric>{vehicle.speed} km/h</TD>
              <TD>
                <StatusPill status={vehicle.status} />
              </TD>
              <TD className="text-right">
                {isPending ? (
                  <output aria-label="Saving changes" className="inline-flex size-control-sm items-center justify-center text-accent-fg">
                    <Spinner />
                  </output>
                ) : (
                  <IconButton
                    label={`More actions for ${vehicle.plate}`}
                    size="sm"
                    icon={<MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={1.5} />}
                  />
                )}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

export function StyleGuidePage() {
  useDocumentTitle("Styleguide");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tableState, setTableState] = useState<TableState>("default");

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-topbar max-w-screen-2xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-control-sm items-center justify-center rounded-md bg-accent text-text-inverse">
              <Truck aria-hidden="true" className="size-4" strokeWidth={1.5} />
            </span>
            <span className="hidden text-md font-medium text-text sm:inline">Fleet Console</span>
            <span className="hidden text-sm text-subtle sm:inline">Styleguide</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted md:inline">Accent</span>
            <AccentPicker />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-12 px-4 py-8 sm:px-6">
        <div className="max-w-prose space-y-2">
          <p className="label-caps text-accent-fg">Design system</p>
          <h1 className="text-lg font-semibold text-text">Fleet Console foundations</h1>
          <p className="text-sm text-muted">
            Every token, component and state in one place. Switch the theme and accent above; both persist across reloads.
          </p>
        </div>

        <Section id="foundations" title="Foundations" description="Surfaces, status colours, accent and type. No raw colours outside these tokens.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "App background", className: "bg-bg" },
              { label: "Surface", className: "bg-surface" },
              { label: "Surface 2", className: "bg-surface-2" },
              { label: "Surface 3", className: "bg-surface-3" },
              { label: "Accent", className: "bg-accent" },
              { label: "Moving", className: "bg-moving" },
              { label: "Idle", className: "bg-idle" },
              { label: "Alert", className: "bg-alert" },
            ].map((swatch) => (
              <div key={swatch.label} className="rounded-lg border border-border bg-surface p-3">
                <div className={`h-12 rounded-md border border-border ${swatch.className}`} />
                <p className="mt-2 text-xs text-muted">{swatch.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="label-caps text-muted">Typography</p>
              <p className="text-lg font-semibold text-text">20 / 28 semibold</p>
              <p className="text-md font-medium text-text">16 / 24 medium</p>
              <p className="text-base text-text">14 / 20 regular body text</p>
              <p className="text-sm text-muted">13 / 20 dense table and secondary UI</p>
              <p className="text-xs text-subtle">12 / 16 caption and helper text</p>
            </div>
            <div className="space-y-2">
              <p className="label-caps text-muted">Data</p>
              <p className="font-mono text-sm text-text">LSD-100-AA · 358192049182736</p>
              <p className="text-stat text-text">1,248</p>
              <p className="text-xs text-muted">Numbers use tabular figures everywhere.</p>
            </div>
          </div>
        </Section>

        <Section id="buttons" title="Buttons" description="One primary action per view. Loading keeps its label and disables the action.">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" leadingIcon={<Plus className="size-4" strokeWidth={1.5} />}>
              Create trip
            </Button>
            <Button variant="secondary">Assign driver</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Delete</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <IconButton label="More actions" icon={<MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={1.5} />} />
            <IconButton label="Filters" variant="secondary" icon={<Filter aria-hidden="true" className="size-4" strokeWidth={1.5} />} />
          </div>
        </Section>

        <Section id="inputs" title="Inputs" description="Labels stay visible. Errors are described, not colour-only.">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Email" placeholder="dispatcher@operator.example" name="email" />
            <Input label="Password" type="password" defaultValue="not-a-real-password" hint="At least 12 characters." name="password" />
            <Input label="Plate" defaultValue="LSD-100-AA" error="This plate is already registered." name="plate" />
            <Input label="Disabled" defaultValue="Read only" disabled name="disabled" />
            <SearchInput value={search} onChange={setSearch} />
            <Select label="Status" defaultValue="all" name="status">
              <option value="all">All vehicles</option>
              <option value="moving">Moving</option>
              <option value="idle">Idle</option>
              <option value="offline">Offline</option>
            </Select>
            <Textarea label="Note" placeholder="Add a note for the next shift." hint="Visible to dispatchers." />
            <div className="flex flex-col gap-3">
              <Checkbox label="Notify the security desk" defaultChecked />
              <Checkbox label="Include archived trips" />
            </div>
          </div>
        </Section>

        <Section id="badges" title="Badges and status" description="Colour, icon and label together. Severity and trip status never rely on colour alone.">
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <StatusPill key={status} status={status} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {severities.map((severity) => (
              <SeverityBadge key={severity} level={severity} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {alertStatuses.map((status) => (
              <AlertStatusBadge key={status} status={status} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {tripStatuses.map((status) => (
              <TripStatusBadge key={status} status={status} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="warning">Stale · 14:02</Badge>
          </div>
        </Section>

        <Section id="stats" title="Stats" description="A single strip of bordered cells. Numbers use tabular figures.">
          <div className="flex flex-wrap rounded-lg border border-border bg-surface">
            <Stat label="Vehicles online" value="20" hint="of 20" />
            <Stat label="Active trips" value="5" hint="2 behind schedule" />
            <Stat label="Open alerts" value="3" hint="1 critical" />
            <Stat label="Last data age" value="4s" hint="Live" />
          </div>
        </Section>

        <Section id="motion" title="Loading and motion" description="Short, purposeful motion for feedback. Reduced motion turns the animation off.">
          <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="label-caps text-muted">Page progress</p>
                <span className="text-xs text-muted">Indeterminate</span>
              </div>
              <LoadingBar />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 text-sm text-text">
                <Spinner />
                Loading vehicles
              </span>
              <span className="inline-flex items-center gap-2 text-sm text-text">
                <Skeleton className="w-24" />
                Skeleton
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="label-caps text-muted">Connection</p>
              <div className="mt-3 flex flex-col gap-3">
                <ConnectionIndicator state="live" />
                <ConnectionIndicator state="reconnecting" />
                <ConnectionIndicator state="offline" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="label-caps text-muted">Pending row</p>
              <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="font-mono text-sm text-text">LSD-100-AA</span>
                <span className="inline-flex items-center gap-1 text-xs text-accent-fg">
                  <Spinner />
                  Saving…
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">The row shows the local change while the request finishes.</p>
            </div>
          </div>
        </Section>

        <Section id="table" title="Table" description="Dense rows, sticky header, selected state and numeric alignment. Use the state switch to preview the list states.">
          <fieldset aria-label="Table states" className="m-0 flex flex-wrap gap-1 border-0 p-0">
            {tableStates.map((state) => (
              <Button
                key={state.id}
                size="sm"
                variant={tableState === state.id ? "secondary" : "ghost"}
                aria-pressed={tableState === state.id}
                onClick={() => setTableState(state.id)}
              >
                {state.label}
              </Button>
            ))}
          </fieldset>

          {tableState === "default" || tableState === "pending" ? (
            <VehicleTable pending={tableState === "pending"} />
          ) : null}

          {tableState === "loading" ? (
            <div className="rounded-lg border border-border bg-surface">
              <LoadingState rows={4} />
            </div>
          ) : null}

          {tableState === "empty" ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                title="No vehicles match"
                description="No vehicles match the current filter. Clear it to see the full fleet."
                action={
                  <Button size="sm" variant="secondary">
                    Clear filter
                  </Button>
                }
              />
            </div>
          ) : null}

          {tableState === "error" ? (
            <div className="rounded-lg border border-border bg-surface">
              <ErrorState error={sampleError} onRetry={() => setTableState("default")} />
            </div>
          ) : null}
        </Section>

        <Section id="drawer" title="Drawer" description="Vehicle detail opens from the right, 420px wide, with a sticky header and Esc to close.">
          <Button variant="primary" onClick={() => setDrawerOpen(true)}>
            Open vehicle drawer
          </Button>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="LSD-103-AA"
            headerAside={
              <div className="flex items-center gap-2">
                <StatusPill status="alert" />
                <span className="text-xs text-muted">Updated 4s ago</span>
              </div>
            }
          >
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="label-caps text-muted">Speed</dt>
                  <dd className="tabular-nums text-text">74 km/h</dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Heading</dt>
                  <dd className="tabular-nums text-text">272° W</dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Last seen</dt>
                  <dd className="tabular-nums text-text">4s ago</dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Trip</dt>
                  <dd className="text-text">Refinery → Ibadan</dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Driver</dt>
                  <dd className="text-text">Tunde Bello</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary">
                  Centre on map
                </Button>
                <Button size="sm" variant="secondary">
                  Play back
                </Button>
                <Button size="sm" variant="ghost">
                  Edit
                </Button>
                <Button size="sm" variant="ghost">
                  Assign driver
                </Button>
              </div>
              <div className="border-t border-border pt-4">
                <p className="label-caps text-muted">Recent events</p>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-text">
                    <Bell aria-hidden="true" className="size-4 text-alert-fg" strokeWidth={1.5} />
                    Route deviation · 2 min ago
                  </div>
                  <div className="flex items-center gap-2 text-text">
                    <WifiOff aria-hidden="true" className="size-4 text-subtle" strokeWidth={1.5} />
                    Device offline · 18 min ago
                  </div>
                </div>
              </div>
            </div>
          </Drawer>
        </Section>

        <Section id="states" title="States" description="Every list and panel has loading, empty, error, forbidden and stale treatments.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface">
              <LoadingState />
            </div>
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                title="No vehicles match"
                description='No vehicles match "KJA 123". Clear the filter to see all 20.'
                action={
                  <Button size="sm" variant="secondary" leadingIcon={<Search className="size-icon-sm" strokeWidth={1.5} />}>
                    Clear filter
                  </Button>
                }
              />
            </div>
            <div className="rounded-lg border border-border bg-surface">
              <ErrorState error={sampleError} onRetry={() => undefined} />
            </div>
            <div className="rounded-lg border border-border bg-surface">
              <ForbiddenState />
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-caps text-muted">Vehicle list</p>
                  <p className="text-sm text-text">20 vehicles</p>
                </div>
                <Badge tone="warning">Stale · 14:02</Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <ChevronRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
                Showing the last known positions.
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
