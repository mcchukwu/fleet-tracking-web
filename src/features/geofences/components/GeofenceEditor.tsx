import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useBlocker } from "@tanstack/react-router";
import type { Geofence, GeofenceUpdate } from "../../../api/types";
import { InlineError } from "../../../errors/InlineError";
import { SlowNotice } from "../../../errors/SlowNotice";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { IconButton } from "../../../ui/IconButton";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { Spinner } from "../../../ui/Spinner";
import type { LngLat } from "../../../map/types";
import type { GeofenceDrawingController } from "../hooks/useGeofenceDrawing";
import type { GeofenceWriteController } from "../hooks/useGeofenceWrite";
import {
  GEOFENCE_FORM_DEFAULT,
  geofenceFormSchema,
  toCreateInput,
  toUpdateInput,
  type GeofenceFormValues,
} from "../lib/form";
import { exteriorRing, ringProblemCopy, validateRing } from "../lib/geometry";
import { GEOFENCE_KIND_LABELS, GEOFENCE_KIND_ORDER } from "../lib/kinds";
import { geofenceWriteCopy } from "../lib/reconcile";

export interface GeofenceEditorProps {
  mode: "create" | "edit";
  geofence: Geofence | null;
  drawing: GeofenceDrawingController;
  write: GeofenceWriteController;
  knownIds: ReadonlySet<string>;
  geometryEditable: boolean;
  geometryNote?: string;
  disabledReason?: string;
  onClose: () => void;
  onSaved: (id: string | null) => void;
  onRefresh: () => void;
}

const NO_POLYGON = "Draw and close a polygon before saving.";

export function GeofenceEditor({
  mode,
  geofence,
  drawing,
  write,
  knownIds,
  geometryEditable,
  geometryNote,
  disabledReason,
  onClose,
  onSaved,
  onRefresh,
}: GeofenceEditorProps) {
  "use no memo";
  const [polygonError, setPolygonError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const resetWrite = write.reset;

  const baselineRing: LngLat[] | null = geofence ? exteriorRing(geofence.geometry) : null;
  const baseline = geofence
    ? { name: geofence.name, kind: geofence.kind, ring: baselineRing ?? [] }
    : null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<GeofenceFormValues>({
    resolver: zodResolver(geofenceFormSchema),
    mode: "onBlur",
    defaultValues: geofence
      ? { name: geofence.name, kind: geofence.kind }
      : GEOFENCE_FORM_DEFAULT,
  });

  useEffect(() => {
    reset(geofence ? { name: geofence.name, kind: geofence.kind } : GEOFENCE_FORM_DEFAULT);
    // oxlint-disable-next-line react/set-state-in-effect -- a different geofence is an external reset event.
    setPolygonError(null);
    // oxlint-disable-next-line react/set-state-in-effect -- a different geofence is an external reset event.
    setGone(false);
    resetWrite();
  }, [geofence, reset, resetWrite]);

  useEffect(() => {
    if (write.error || polygonError) errorRef.current?.focus();
  }, [write.error, polygonError]);

  const dirty = isDirty || drawing.dirty;
  const dirtyRef = useRef(dirty);
  const skipBlockerRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const blocker = useBlocker({
    shouldBlockFn: () => !skipBlockerRef.current && dirtyRef.current,
    withResolver: true,
    disabled: !dirty,
    enableBeforeUnload: dirty,
  });
  const discardVisible = discardOpen || blocker.status === "blocked";
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (discardVisible) keepRef.current?.focus();
  }, [discardVisible]);

  function currentRing(): LngLat[] | null {
    if (!geometryEditable) return baselineRing;
    const geometry = drawing.getGeometry();
    const ring = geometry?.coordinates[0];
    return ring ? ring.map((point) => [point[0] ?? 0, point[1] ?? 0] as LngLat) : null;
  }

  function requestClose(): void {
    if (write.pending) return;
    if (!dirty) {
      onClose();
      return;
    }
    pendingAction.current = onClose;
    setDiscardOpen(true);
  }

  function keepEditing(): void {
    pendingAction.current = null;
    if (blocker.status === "blocked") blocker.reset();
    setDiscardOpen(false);
  }

  function discard(): void {
    setDiscardOpen(false);
    if (blocker.status === "blocked") {
      blocker.proceed();
      return;
    }
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }

  // oxlint-disable-next-line react/refs -- refs are only written inside the submit event, never during render.
  const submit = handleSubmit(async (values) => {
    setPolygonError(null);
    setGone(false);
    const finish = (id: string | null): void => {
      skipBlockerRef.current = true;
      onSaved(id);
    };

    if (mode === "edit" && geofence && !geometryEditable) {
      const update: GeofenceUpdate = {};
      if (values.name.trim() !== geofence.name.trim()) update.name = values.name.trim();
      if (values.kind !== geofence.kind) update.kind = values.kind;
      if (Object.keys(update).length === 0) {
        finish(geofence.id);
        return;
      }
      const outcome = await write.update(geofence, update);
      if (outcome.status === "done") finish(geofence.id);
      else if (outcome.status === "gone") setGone(true);
      return;
    }

    const ring = currentRing();
    if (!ring) {
      setPolygonError(NO_POLYGON);
      return;
    }
    const validated = validateRing(ring);
    if (!validated.ok) {
      setPolygonError(ringProblemCopy(validated.problem));
      return;
    }

    if (mode === "create") {
      const input = toCreateInput(values, validated.ring);
      if (!input) {
        setPolygonError(NO_POLYGON);
        return;
      }
      const outcome = await write.create(input, knownIds);
      if (outcome.status === "created") finish(outcome.id);
      else if (outcome.status === "reconciled") finish(outcome.id);
      return;
    }

    if (!geofence || !baseline) return;
    const update = toUpdateInput(baseline, values, validated.ring);
    if (!update) {
      setPolygonError(NO_POLYGON);
      return;
    }
    if (Object.keys(update).length === 0) {
      finish(geofence.id);
      return;
    }
    const outcome = await write.update(geofence, update);
    if (outcome.status === "done") finish(geofence.id);
    else if (outcome.status === "gone") setGone(true);
  });

  const failureCopy = write.error
    ? geofenceWriteCopy(write.error, mode === "create" ? "create" : "update")
    : null;
  const saveDisabled =
    write.pending || (geometryEditable && drawing.status !== "ready") || Boolean(disabledReason);
  const title = mode === "create" ? "New geofence" : "Edit geofence";
  const shapeNote = geometryNote ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="text-text text-sm font-medium">{title}</h2>
        <IconButton
          label="Close editor"
          size="sm"
          icon={<X aria-hidden="true" className="size-4" strokeWidth={1.5} />}
          onClick={requestClose}
        />
      </div>

      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the form's Escape/Enter must not reach the map's drawing keys. */}
      <form
        aria-label={title}
        onSubmit={(event) => {
          void submit(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Backspace" || event.key === "Escape") {
            event.stopPropagation();
          }
        }}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
      >
        <Input
          label="Name"
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
        <Select label="Kind" error={errors.kind?.message} {...register("kind")}>
          {GEOFENCE_KIND_ORDER.map((kind) => (
            <option key={kind} value={kind}>
              {GEOFENCE_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>

        <div ref={errorRef} tabIndex={-1} className="flex flex-col gap-1">
          {drawing.status === "preparing" ? (
            <p className="text-muted flex items-center gap-2 text-sm">
              <Spinner />
              Preparing the drawing tool…
            </p>
          ) : null}
          {drawing.status === "error" && drawing.error ? (
            <div role="alert" className="text-danger flex items-start gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">The drawing tool couldn't load.</p>
                <p>Check your connection and retry.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={drawing.retry}>
                Retry
              </Button>
            </div>
          ) : null}
          {drawing.status === "ready" && !drawing.geometry ? (
            <p className="text-muted text-sm">Draw a polygon on the map to continue.</p>
          ) : null}
          {drawing.status === "ready" && drawing.geometry ? (
            <p className="text-muted text-sm">Polygon ready.</p>
          ) : null}
          {shapeNote ? <p className="text-muted text-sm">{shapeNote}</p> : null}
          {polygonError ? (
            <p className="text-danger text-sm" role="alert">
              {polygonError}
            </p>
          ) : null}
          {gone ? (
            <div role="alert" className="text-danger flex items-center gap-2 text-sm">
              <span className="flex-1">This geofence no longer exists.</span>
              <Button size="sm" variant="ghost" onClick={onRefresh}>
                Refresh
              </Button>
            </div>
          ) : null}
          {failureCopy && write.error ? (
            <InlineError
              error={write.error}
              copy={failureCopy}
              onRetry={write.retry}
            />
          ) : null}
        </div>

        {write.pending ? <SlowNotice onCancel={write.cancel} onRetry={write.retry} /> : null}

        <div className="mt-auto flex justify-end gap-2">
          <Button variant="ghost" onClick={requestClose} disabled={write.pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={write.pending}
            disabled={saveDisabled}
            {...(disabledReason ? { disabledReason } : {})}
          >
            {mode === "create" ? "Create geofence" : "Save changes"}
          </Button>
        </div>
      </form>

      <Dialog
        open={discardVisible}
        onOpenChange={(open) => {
          if (!open) keepEditing();
        }}
        title="Discard changes?"
        description="Your polygon and form values will be lost."
        variant="confirm"
        footer={
          <>
            <Button ref={keepRef} onClick={keepEditing}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={discard}>
              Discard
            </Button>
          </>
        }
      />
    </div>
  );
}
