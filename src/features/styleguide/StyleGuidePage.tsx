import { useState, type ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  Filter,
  Map,
  MoreHorizontal,
  Plus,
  Search,
  WifiOff,
  ZoomIn,
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
import { Banner } from "../../ui/Banner";
import { BrandLogo } from "../../ui/BrandLogo";
import { Button } from "../../ui/Button";
import { validateDatetimeRange } from "../../lib/datetime";
import { Checkbox } from "../../ui/Checkbox";
import { Combobox } from "../../ui/Combobox";
import { DateRangeDialog } from "../../ui/DateRangeDialog";
import { Dialog } from "../../ui/Dialog";
import { Drawer } from "../../ui/Drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import { IconButton } from "../../ui/IconButton";
import { Input } from "../../ui/Input";
import { SearchInput } from "../../ui/SearchInput";
import { Select } from "../../ui/Select";
import { Stat } from "../../ui/Stat";
import { CopyButton } from "../../ui/CopyButton";
import { Timestamp } from "../../ui/Timestamp";
import {
  EmptyState,
  ForbiddenState,
  LoadingBar,
  LoadingState,
  Skeleton,
} from "../../ui/StatePanel";
import { ErrorState } from "../../errors/ErrorState";
import type { AppError } from "../../errors/types";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Spinner } from "../../ui/Spinner";
import { DataTable, type DataTableColumn } from "../../ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/Tabs";
import { Textarea } from "../../ui/Textarea";
import { useToast } from "../../ui/Toast";
import { Tooltip } from "../../ui/Tooltip";
import { InlineError } from "../../errors/InlineError";
import { EvidenceList } from "../../ui/EvidenceList";
import { PageFrame } from "../../ui/PageFrame";

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
        <h2 className="text-md text-text font-medium">{title}</h2>
        <p className="text-muted text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

const vehicles = [
  {
    plate: "LSD-100-AA",
    driver: "Adebayo Okafor",
    speed: 62,
    status: "moving" as const,
  },
  {
    plate: "LSD-101-AA",
    driver: "Chinedu Musa",
    speed: 0,
    status: "idle" as const,
  },
  {
    plate: "LSD-102-AA",
    driver: "Musa Adeyemi",
    speed: 0,
    status: "offline" as const,
  },
  {
    plate: "LSD-103-AA",
    driver: "Tunde Bello",
    speed: 74,
    status: "alert" as const,
  },
];

const statuses = ["moving", "idle", "offline", "alert"] as const;
const severities: Severity[] = ["low", "medium", "high", "critical"];
const alertStatuses: AlertStatus[] = ["open", "acked", "closed"];
const tripStatuses: TripStatus[] = [
  "planned",
  "assigned",
  "active",
  "completed",
  "cancelled",
];

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

type VehicleRow = (typeof vehicles)[number];

const UNKNOWN_BADGE_VALUE =
  "unmapped_status_returned_by_a_newer_server_build_12345678901";

const unknownBadgeLabels = {
  status: `Unknown status: ${UNKNOWN_BADGE_VALUE}`,
  severity: `Unknown severity: ${UNKNOWN_BADGE_VALUE}`,
  type: `Unknown type: ${UNKNOWN_BADGE_VALUE}`,
  trip: `Unknown status: ${UNKNOWN_BADGE_VALUE}`,
} as const;

type UnknownBadgeRow = { id: string };

const unknownBadgeRows: UnknownBadgeRow[] = [{ id: "unknown" }];

function unknownBadgeColumns(): DataTableColumn<UnknownBadgeRow>[] {
  return [
    {
      id: "status",
      header: "Status",
      width: 120,
      align: "left",
      title: () => unknownBadgeLabels.status,
      cell: () => <Badge tone="neutral">{unknownBadgeLabels.status}</Badge>,
    },
    {
      id: "severity",
      header: "Severity",
      width: 120,
      align: "left",
      title: () => unknownBadgeLabels.severity,
      cell: () => <Badge tone="neutral">{unknownBadgeLabels.severity}</Badge>,
    },
    {
      id: "type",
      header: "Alert type",
      width: 160,
      align: "left",
      title: () => unknownBadgeLabels.type,
      cell: () => <Badge tone="neutral">{unknownBadgeLabels.type}</Badge>,
    },
    {
      id: "trip",
      header: "Trip status",
      width: 120,
      align: "left",
      title: () => unknownBadgeLabels.trip,
      cell: () => <Badge tone="neutral">{unknownBadgeLabels.trip}</Badge>,
    },
  ];
}

function vehicleColumns(pending: boolean): DataTableColumn<VehicleRow>[] {
  return [
    {
      id: "vehicle",
      header: "Vehicle",
      width: 160,
      cell: (vehicle) => (
        <span className="text-text font-mono text-sm">{vehicle.plate}</span>
      ),
      title: (vehicle) => vehicle.plate,
      truncate: false,
    },
    {
      id: "driver",
      header: "Driver",
      width: 180,
      cell: (vehicle) => vehicle.driver,
      title: (vehicle) => vehicle.driver,
    },
    {
      id: "speed",
      header: "Speed",
      width: 110,
      align: "right",
      cell: (vehicle) => `${vehicle.speed} km/h`,
    },
    {
      id: "status",
      header: "Status",
      width: 120,
      cell: (vehicle) => <StatusPill status={vehicle.status} />,
      title: (vehicle) => vehicle.status,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      width: 64,
      align: "right",
      cell: (vehicle, index) =>
        pending && index === 0 ? (
          <output
            aria-label="Saving changes"
            className="size-control-sm text-accent-fg inline-flex items-center justify-center"
          >
            <Spinner />
          </output>
        ) : (
          <IconButton
            label={`More actions for ${vehicle.plate}`}
            size="sm"
            icon={
              <MoreHorizontal
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.5}
              />
            }
          />
        ),
    },
  ];
}

function VehicleTable({ pending = false }: { pending?: boolean }) {
  return (
    <div className="h-64">
      <DataTable
        label="Vehicles"
        columns={vehicleColumns(pending)}
        rows={vehicles}
        rowKey={(vehicle) => vehicle.plate}
        selected={(_vehicle, index) => index === 0}
        rowProps={(_vehicle, index) => {
          const isPending = pending && index === 0;
          return {
            "aria-busy": isPending || undefined,
            "aria-selected": index === 0 || undefined,
            className: isPending ? "opacity-60" : undefined,
          };
        }}
      />
    </div>
  );
}

export function StyleGuidePage() {
  useDocumentTitle("Styleguide");
  const [search, setSearch] = useState("");
  const [driverId, setDriverId] = useState<string | null>("driver-1");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageDrawerOpen, setPageDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockingOpen, setBlockingOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [tableState, setTableState] = useState<TableState>("default");
  const { toast } = useToast();

  return (
    <div className="bg-bg text-text flex h-dvh flex-col overflow-hidden">
      <header className="border-border bg-surface z-topbar shrink-0 border-b">
        <div className="h-topbar mx-auto flex max-w-screen-2xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden sm:inline-flex">
              <BrandLogo variant="lockup" />
            </span>
            <span className="sm:hidden">
              <BrandLogo variant="symbol" />
            </span>
            <span className="text-subtle hidden text-sm sm:inline">
              Styleguide
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted hidden text-xs md:inline">Accent</span>
            <AccentPicker />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <PageFrame
        layout="scroll"
        width="full"
        contentClassName="mx-auto max-w-screen-2xl px-4 pt-8 sm:px-6"
      >
        <main className="flex flex-col gap-12">
          <div className="max-w-prose space-y-2">
            <p className="label-caps text-accent-fg">Design system</p>
            <h1 className="text-text text-lg font-semibold">
              Fleet Console foundations
            </h1>
            <p className="text-muted text-sm">
              Every token, component and state in one place. Switch the theme
              and accent above; both persist across reloads.
            </p>
          </div>

          <Section
            id="foundations"
            title="Foundations"
            description="Surfaces, status colours, accent and type. No raw colours outside these tokens."
          >
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
                <div
                  key={swatch.label}
                  className="border-border bg-surface rounded-lg border p-3"
                >
                  <div
                    className={`border-border h-12 rounded-md border ${swatch.className}`}
                  />
                  <p className="text-muted mt-2 text-xs">{swatch.label}</p>
                </div>
              ))}
            </div>

            <div className="border-border bg-surface grid gap-4 rounded-lg border p-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="label-caps text-muted">Typography</p>
                <p className="text-text text-lg font-semibold">
                  20 / 28 semibold
                </p>
                <p className="text-md text-text font-medium">16 / 24 medium</p>
                <p className="text-text text-base">14 / 20 regular body text</p>
                <p className="text-muted text-sm">
                  13 / 20 dense table and secondary UI
                </p>
                <p className="text-subtle text-xs">
                  12 / 16 caption and helper text
                </p>
              </div>
              <div className="space-y-2">
                <p className="label-caps text-muted">Data</p>
                <p className="text-text font-mono text-sm">
                  LSD-100-AA · 358192049182736
                </p>
                <p className="text-stat text-text">1,248</p>
                <p className="text-muted text-xs">
                  Numbers use tabular figures everywhere.
                </p>
              </div>
            </div>
          </Section>

          <Section
            id="buttons"
            title="Buttons"
            description="One primary action per view. Loading keeps its label and disables the action."
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                leadingIcon={<Plus className="size-4" strokeWidth={1.5} />}
              >
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
              <Button disabledReason="Your role can't change trips.">
                Start
              </Button>
              <IconButton
                label="More actions"
                icon={
                  <MoreHorizontal
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.5}
                  />
                }
              />
              <IconButton
                label="Filters"
                variant="secondary"
                icon={
                  <Filter
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.5}
                  />
                }
              />
              <IconButton
                size="lg"
                label="Zoom in"
                icon={
                  <ZoomIn
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.5}
                  />
                }
              />
            </div>
          </Section>

          <Section
            id="inputs"
            title="Inputs"
            description="Labels stay visible. Errors are described, not colour-only."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Email"
                placeholder="dispatcher@operator.example"
                name="email"
              />
              <Input
                label="Password"
                type="password"
                defaultValue="not-a-real-password"
                hint="At least 12 characters."
                name="password"
              />
              <Input
                label="Plate"
                defaultValue="LSD-100-AA"
                error="This plate is already registered."
                name="plate"
              />
              <Input
                label="Disabled"
                defaultValue="Read only"
                disabled
                name="disabled"
              />
              <SearchInput value={search} onChange={setSearch} />
              <SearchInput
                compact
                label="Compact vehicle search"
                value={search}
                onChange={setSearch}
              />
              <Select label="Status" defaultValue="all" name="status">
                <option value="all">All vehicles</option>
                <option value="moving">Moving</option>
                <option value="idle">Idle</option>
                <option value="offline">Offline</option>
              </Select>
              <Combobox
                label="Assign driver"
                items={[
                  {
                    id: "driver-1",
                    label: "Adebayo Okafor",
                    description: "08031000010 · LIC-01010",
                  },
                  {
                    id: "driver-2",
                    label: "Adebayo Okafor",
                    description: "08031000000 · LIC-01000",
                  },
                  {
                    id: "driver-3",
                    label: "Chinedu Musa",
                    description: "08031000001 · LIC-01001",
                  },
                ]}
                value={driverId}
                selectedLabel="Adebayo Okafor"
                onChange={setDriverId}
              />
              <Combobox
                label="Disabled driver"
                items={[]}
                value={null}
                onChange={() => undefined}
                disabled
                disabledReason="Your role can't assign a driver."
              />
              <Combobox
                label="Loading drivers"
                items={[]}
                value={null}
                onChange={() => undefined}
                loading
              />
              <Combobox
                label="Drivers unavailable"
                items={[
                  {
                    id: "driver-1",
                    label: "Adebayo Okafor",
                    description: "08031000010 · LIC-01010",
                  },
                  {
                    id: "driver-2",
                    label: "Chinedu Musa",
                    description: "08031000001 · LIC-01001",
                  },
                ]}
                value={driverId}
                onChange={setDriverId}
                error="Couldn't refresh drivers. Showing the last list."
                onRetry={() =>
                  toast({
                    tone: "info",
                    title: "Retrying drivers",
                    key: "styleguide-picker-retry",
                  })
                }
              />
              <Combobox
                label="Optional driver"
                items={[
                  {
                    id: "driver-1",
                    label: "Adebayo Okafor",
                    description: "08031000010 · LIC-01010",
                  },
                  {
                    id: "driver-3",
                    label: "Chinedu Musa",
                    description: "08031000001 · LIC-01001",
                  },
                ]}
                value={driverId}
                onChange={setDriverId}
                clearable
                onClear={() => setDriverId(null)}
              />
              <Textarea
                label="Note"
                placeholder="Add a note for the next shift."
                hint="Visible to dispatchers."
              />
              <div className="flex flex-col gap-3">
                <Checkbox label="Notify the security desk" defaultChecked />
                <Checkbox label="Include archived trips" />
              </div>
            </div>
          </Section>

          <Section
            id="badges"
            title="Badges and status"
            description="Colour, icon and label together. Severity and trip status never rely on colour alone."
          >
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

          <Section
            id="stats"
            title="Stats"
            description="A single strip of bordered cells. Numbers use tabular figures."
          >
            <div className="border-border bg-surface flex flex-wrap rounded-lg border">
              <Stat
                label="Vehicles online"
                value="20"
                hint="of 20"
                leading={
                  <span
                    aria-hidden="true"
                    className="bg-moving size-2 rounded-full"
                  />
                }
              />
              <Stat label="Active trips" value="5" hint="2 behind schedule" />
              <Stat label="Open alerts" value="3" hint="1 critical" />
              <Stat label="Last data age" value="4s" hint="Live" />
            </div>
          </Section>

          <Section
            id="data-display"
            title="Data display"
            description="Relative times carry a local and UTC tooltip. Plates and IMEIs copy on click. Compact stats fit the mobile KPI grid."
          >
            <div className="border-border bg-surface flex flex-wrap items-center gap-4 rounded-lg border p-4">
              <Timestamp iso="2026-11-04T09:58:00Z" />
              <CopyButton value="LSD-100-AA" label="Plate" />
              <CopyButton value="demo-imei-0001" label="IMEI" />
              <CopyButton
                value="imei,plate,year"
                label="Header row"
                appearance="button"
              />
              <div className="border-border bg-border grid w-full max-w-sm grid-cols-2 gap-px rounded-lg border">
                <div className="bg-surface">
                  <Stat size="sm" label="Online" value="20 of 25" />
                </div>
                <div className="bg-surface">
                  <Stat size="sm" label="Active trips" value="4" />
                </div>
                <div className="bg-surface">
                  <Stat size="sm" label="Open alerts" value="45" />
                </div>
                <div className="bg-surface">
                  <Stat size="sm" label="Last data" value="4s" />
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="motion"
            title="Loading and motion"
            description="Short, purposeful motion for feedback. Reduced motion turns the animation off."
          >
            <div className="border-border bg-surface space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="label-caps text-muted">Page progress</p>
                  <span className="text-muted text-xs">Indeterminate</span>
                </div>
                <LoadingBar />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-text inline-flex items-center gap-2 text-sm">
                  <Spinner />
                  Loading vehicles
                </span>
                <span className="text-text inline-flex items-center gap-2 text-sm">
                  <Skeleton className="w-24" />
                  Skeleton
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="border-border bg-surface rounded-lg border p-4">
                <p className="label-caps text-muted">Connection</p>
                <div className="mt-3 flex flex-col gap-3">
                  <ConnectionIndicator state="live" />
                  <ConnectionIndicator state="online" />
                  <ConnectionIndicator state="reconnecting" />
                  <ConnectionIndicator state="offline" />
                </div>
              </div>
              <div className="border-border bg-surface rounded-lg border p-4">
                <p className="label-caps text-muted">Pending row</p>
                <div className="border-border mt-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="text-text font-mono text-sm">
                    LSD-100-AA
                  </span>
                  <span className="text-accent-fg inline-flex items-center gap-1 text-xs">
                    <Spinner />
                    Saving…
                  </span>
                </div>
                <p className="text-muted mt-2 text-xs">
                  The row shows the local change while the request finishes.
                </p>
              </div>
            </div>
          </Section>

          <Section
            id="table"
            title="Table"
            description="Dense rows, sticky header, selected state and numeric alignment. Use the state switch to preview the list states."
          >
            <fieldset
              aria-label="Table states"
              className="m-0 flex flex-wrap gap-1 border-0 p-0"
            >
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
              <div className="border-border bg-surface rounded-lg border">
                <LoadingState rows={4} />
              </div>
            ) : null}

            {tableState === "empty" ? (
              <div className="border-border bg-surface rounded-lg border">
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
              <div className="border-border bg-surface rounded-lg border">
                <ErrorState
                  error={sampleError}
                  onRetry={() => setTableState("default")}
                />
              </div>
            ) : null}
          </Section>

          <Section
            id="badge-overflow"
            title="Long values in cells"
            description="A badge never overflows its cell. Long unknown values ellipsize inside the badge and the cell tooltip keeps the full text."
          >
            <div className="h-40">
              <DataTable
                label="Unknown values in cells"
                columns={unknownBadgeColumns()}
                rows={unknownBadgeRows}
                rowKey={(row) => row.id}
              />
            </div>
          </Section>

          <Section
            id="drawer"
            title="Drawer"
            description="Vehicle detail opens from the right, 420px wide, with a sticky header and Esc to close."
          >
            <Button variant="primary" onClick={() => setDrawerOpen(true)}>
              Open vehicle drawer
            </Button>
            <Drawer
              open={drawerOpen}
              label="Vehicle details for LSD-103-AA"
              onClose={() => setDrawerOpen(false)}
              title="LSD-103-AA"
              headerAside={
                <div className="flex items-center gap-2">
                  <StatusPill status="alert" />
                  <span className="text-muted text-xs">Updated 4s ago</span>
                </div>
              }
              actions={
                <>
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
                </>
              }
            >
              <div className="space-y-4 p-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="label-caps text-muted">Speed</dt>
                    <dd className="text-text tabular-nums">74 km/h</dd>
                  </div>
                  <div>
                    <dt className="label-caps text-muted">Heading</dt>
                    <dd className="text-text tabular-nums">272° W</dd>
                  </div>
                  <div>
                    <dt className="label-caps text-muted">Last seen</dt>
                    <dd className="text-text tabular-nums">4s ago</dd>
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
                <div className="border-border border-t pt-4">
                  <p className="label-caps text-muted">Recent events</p>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="text-text flex items-center gap-2">
                      <Bell
                        aria-hidden="true"
                        className="text-alert-fg size-4"
                        strokeWidth={1.5}
                      />
                      Route deviation · 2 min ago
                    </div>
                    <div className="text-text flex items-center gap-2">
                      <WifiOff
                        aria-hidden="true"
                        className="text-subtle size-4"
                        strokeWidth={1.5}
                      />
                      Device offline · 18 min ago
                    </div>
                  </div>
                </div>
              </div>
            </Drawer>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setPageDrawerOpen(true)}
              >
                Open page drawer
              </Button>
              <span className="text-muted text-xs">
                Alerts detail: right panel at md+, a top-quarter sheet below md.
              </span>
            </div>
            <Drawer
              open={pageDrawerOpen}
              placement="page"
              label="Alert details"
              title="Geofence exit"
              titleClassName="font-sans"
              closeLabel="Close alert details"
              headerAside={
                <div className="flex items-center gap-2">
                  <SeverityBadge level="high" />
                  <AlertStatusBadge status="open" />
                </div>
              }
              onClose={() => setPageDrawerOpen(false)}
            >
              <div className="space-y-4 p-4">
                <EvidenceList
                  evidence={{
                    geofence_id: "00000000-0000-0000-0000-000000000202",
                    distance_m: 2091.58,
                  }}
                />
              </div>
            </Drawer>
          </Section>

          <Section
            id="states"
            title="States"
            description="Every list and panel has loading, empty, error, forbidden and stale treatments."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="border-border bg-surface rounded-lg border">
                <LoadingState />
              </div>
              <div className="border-border bg-surface rounded-lg border">
                <EmptyState
                  title="No vehicles match"
                  description='No vehicles match "KJA 123". Clear the filter to see all 20.'
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      leadingIcon={
                        <Search className="size-icon-sm" strokeWidth={1.5} />
                      }
                    >
                      Clear filter
                    </Button>
                  }
                />
              </div>
              <div className="border-border bg-surface rounded-lg border">
                <ErrorState error={sampleError} onRetry={() => undefined} />
              </div>
              <div className="border-border bg-surface rounded-lg border">
                <ForbiddenState />
              </div>
              <div className="border-border bg-surface rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-caps text-muted">Vehicle list</p>
                    <p className="text-text text-sm">20 vehicles</p>
                  </div>
                  <Badge tone="warning">Stale · 14:02</Badge>
                </div>
                <div className="text-muted mt-3 flex items-center gap-2 text-xs">
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.5}
                  />
                  Showing the last known positions.
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="overlays"
            title="Dialogs"
            description="Centred, 480px maximum, focus trapped, focus returns to the opener. Only session expiry is blocking."
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setDialogOpen(true)}>
                Open dialog
              </Button>
              <Button onClick={() => setBlockingOpen(true)}>
                Open blocking dialog
              </Button>
              <Button onClick={() => setRangeOpen(true)}>
                Open custom range
              </Button>
            </div>

            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="Assign driver"
              description="Choose a driver for LSD-100-AA."
              footer={
                <>
                  <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button
                    variant="primary"
                    onClick={() => setDialogOpen(false)}
                  >
                    Assign
                  </Button>
                </>
              }
            >
              <Input
                label="Driver"
                placeholder="Search drivers"
                name="dialog-driver"
              />
            </Dialog>

            <DateRangeDialog
              open={rangeOpen}
              from="2026-11-01T00:00:00Z"
              to="2026-11-08T00:00:00Z"
              validate={(startIso, endIso) => {
                const result = validateDatetimeRange(startIso, endIso);
                if (!result.valid) return result;
                if (result.toMs - result.fromMs > 30 * 86_400_000) {
                  return {
                    valid: false,
                    reason: "too_long",
                    message: "Choose a range of 30 days or less.",
                    field: "both",
                  };
                }
                return result;
              }}
              onApply={() => setRangeOpen(false)}
              onClose={() => setRangeOpen(false)}
            />

            <Dialog
              open={blockingOpen}
              onOpenChange={setBlockingOpen}
              variant="blocking"
              title="Your session expired"
              description="Sign in to continue. You'll stay where you are."
              footer={<Button variant="primary">Sign in</Button>}
            >
              <div className="space-y-3">
                <Input label="Email" type="email" name="blocking-email" />
                <Input
                  label="Password"
                  type="password"
                  name="blocking-password"
                />
              </div>
            </Dialog>
          </Section>

          <Section
            id="menus"
            title="Menus and tooltips"
            description="Tooltips appear after 400ms on hover and focus. Menus use 32px items on desktop and 44px on touch."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Tooltip label="Open the map">
                <Button
                  leadingIcon={
                    <Map
                      aria-hidden="true"
                      className="size-4"
                      strokeWidth={1.5}
                    />
                  }
                >
                  Map
                </Button>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>Account</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Demo Dispatcher</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Shortcuts</DropdownMenuItem>
                  <DropdownMenuItem>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Tabs defaultValue="vehicle">
              <TabsList aria-label="Detail sections">
                <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
                <TabsTrigger value="trip">Trip</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>
              <TabsContent value="vehicle">
                <p className="text-muted text-sm">
                  Current state, driver and vehicle details.
                </p>
              </TabsContent>
              <TabsContent value="trip">
                <p className="text-muted text-sm">
                  Origin, destination and trip status.
                </p>
              </TabsContent>
              <TabsContent value="events">
                <p className="text-muted text-sm">
                  Geofence events and alerts, newest first.
                </p>
              </TabsContent>
            </Tabs>
          </Section>

          <Section
            id="toasts"
            title="Toasts"
            description="Bottom-right. Success and info dismiss after 4s; errors persist until dismissed and announce assertively."
          >
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  toast({ title: "Trip created", tone: "success" })
                }
              >
                Success toast
              </Button>
              <Button
                onClick={() =>
                  toast({ title: "Vehicle updated", tone: "info" })
                }
              >
                Info toast
              </Button>
              <Button
                onClick={() =>
                  toast({
                    title: "Couldn't save",
                    description: "Check your connection and retry.",
                    tone: "error",
                  })
                }
              >
                Error toast
              </Button>
            </div>
          </Section>

          <Section
            id="banners"
            title="Banners"
            description="One banner in flow below the top bar, highest priority only: session expired, offline, unavailable or storm, reconnecting, update. The region collapses to zero when empty."
          >
            <Banner
              tone="neutral"
              message="You're offline. Showing data from 14:02. Changes are disabled."
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Stale · 14:02</Badge>
              <span title="Reconnect to verify your session.">
                <Badge tone="neutral">Unverified offline</Badge>
                <span className="sr-only">
                  Reconnect to verify your session.
                </span>
              </span>
            </div>
            <Banner
              tone="info"
              message="A new version is available."
              action={{ label: "Reload", onClick: () => undefined }}
            />
            <p className="text-muted text-sm">
              Map isn&apos;t available offline. The vehicle list still works
              with the data saved on this device.
            </p>
          </Section>

          <Section
            id="shell"
            title="Shell chrome and sign-in"
            description="Top bar 48px, icon rail 56px (200px expanded). The login form is a centred 360px panel with visible labels and inline errors."
          >
            <div className="border-border bg-surface overflow-hidden rounded-lg border">
              <div className="h-topbar border-border flex items-center gap-2 border-b px-4">
                <BrandLogo variant="lockup" />
                <div className="h-control-md w-panel border-border-strong bg-surface text-subtle mx-auto flex max-w-full items-center gap-2 rounded-md border px-3 text-sm">
                  <Search
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.5}
                  />
                  Search vehicles
                  <kbd className="border-border bg-surface-2 text-muted ml-auto rounded-sm border px-1 font-mono text-xs">
                    /
                  </kbd>
                </div>
                <ConnectionIndicator state="online" />
              </div>
              <div className="flex min-h-24">
                <nav
                  aria-label="Main preview"
                  className="w-rail border-border flex flex-col items-center gap-1 border-r py-2"
                >
                  <span className="size-control-lg bg-accent-soft text-accent-fg flex items-center justify-center rounded-md">
                    <Map
                      aria-hidden="true"
                      className="size-5"
                      strokeWidth={1.5}
                    />
                  </span>
                  <span className="size-control-lg text-muted flex items-center justify-center rounded-md">
                    <Bell
                      aria-hidden="true"
                      className="size-5"
                      strokeWidth={1.5}
                    />
                  </span>
                </nav>
                <div className="bg-bg text-muted flex flex-1 items-center justify-center text-sm">
                  Map content
                </div>
              </div>
            </div>

            <div className="w-panel border-border bg-surface mx-auto max-w-full space-y-3 rounded-lg border p-4">
              <p className="text-md text-text font-medium">Sign in</p>
              <p className="text-muted text-sm">
                Use your Fleet Console account.
              </p>
              <Input
                label="Email"
                type="email"
                name="preview-email"
                autoComplete="username"
              />
              <Input
                label="Password"
                type="password"
                name="preview-password"
                autoComplete="current-password"
              />
              <InlineError
                error={{ ...sampleError, kind: "unauthenticated" }}
                copy={{ title: "Email or password is incorrect.", detail: "" }}
              />
              <Button variant="primary" className="w-full">
                Sign in
              </Button>
            </div>
          </Section>
        </main>
      </PageFrame>
    </div>
  );
}
