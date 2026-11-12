import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportResult } from "../../../api/types";
import type { ImportPreview as Preview } from "../lib/preview";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { ImportPage } from "./ImportPage";

const result: ImportResult = {
  job_id: "job-1",
  total: 2,
  imported: 2,
  failed: 0,
  errors: null,
};

const preview: Preview = {
  headers: ["imei", "plate"],
  headerRow: ["imei", "plate"],
  rows: [["imei-1", "LSD-100-AA"]],
  unknownHeaders: [],
  duplicateHeaders: [],
  bom: false,
};

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  canMutate: true,
  network: "online",
  preview: {
    state: "idle" as string,
    preview: null as Preview | null,
    issue: null as string | null,
  },
  upload: {
    status: "idle" as string,
    pending: false,
    result: null as ImportResult | null,
    error: null as unknown,
    upload: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
  },
  recent: {
    entries: [] as Array<Record<string, unknown>>,
    state: "ready" as string,
    error: null as unknown,
    add: vi.fn(),
    retry: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("../../../auth/useCanMutate", () => ({
  useCanMutate: (_capability: string, roleReason?: string) => {
    if (!mocks.canMutate) {
      return {
        allowed: false,
        roleAllowed: false,
        blockedBy: "role",
        reason: roleReason ?? "Your role can't make changes.",
      };
    }
    if (mocks.network === "offline") {
      return { allowed: false, roleAllowed: true, blockedBy: "offline", reason: "You're offline." };
    }
    return { allowed: true, roleAllowed: true, blockedBy: null, reason: null };
  },
}));
vi.mock("../../../stores/connection", () => ({
  useConnection: () => ({ network: mocks.network }),
}));
vi.mock("../hooks/useImportPreview", () => ({
  useImportPreview: () => mocks.preview,
}));
vi.mock("../hooks/useImportUpload", () => ({
  useImportUpload: () => mocks.upload,
}));
vi.mock("../hooks/useRecentImports", () => ({
  useRecentImports: () => mocks.recent,
}));

function view(ui: React.ReactNode) {
  return render(
    <TooltipProvider>
      <ToastProvider>{ui}</ToastProvider>
    </TooltipProvider>,
  );
}

async function chooseFile(): Promise<void> {
  await userEvent.upload(
    screen.getByTestId("import-file-input"),
    new File(["imei,plate\nimei-1,LSD-100-AA"], "vehicles.csv", {
      type: "text/csv",
    }),
  );
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.navigate.mockResolvedValue(undefined);
  mocks.canMutate = true;
  mocks.network = "online";
  mocks.preview = { state: "idle", preview: null, issue: null };
  mocks.upload = {
    status: "idle",
    pending: false,
    result: null,
    error: null,
    upload: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
  };
  mocks.recent = {
    entries: [],
    state: "ready",
    error: null,
    add: vi.fn().mockResolvedValue(true),
    retry: vi.fn(),
  };
});

describe("ImportPage", () => {
  it("shows the forbidden state when the role cannot mutate", () => {
    mocks.canMutate = false;
    view(<ImportPage />);
    expect(screen.getByText("You don't have access to this.")).toBeInTheDocument();
    expect(screen.queryByTestId("import-file-picker")).not.toBeInTheDocument();
  });

  it("keeps the upload control visible but inert offline", async () => {
    mocks.network = "offline";
    mocks.preview = { state: "ready", preview, issue: null };
    view(<ImportPage />);
    await chooseFile();

    expect(screen.getByRole("button", { name: "Upload file" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByTestId("import-file-picker")).toBeInTheDocument();
  });

  it("uploads, records the result on this device and hands off to the map", async () => {
    mocks.preview = { state: "ready", preview, issue: null };
    mocks.upload = {
      ...mocks.upload,
      upload: vi.fn().mockResolvedValue({ status: "success", result }),
    };
    view(<ImportPage />);
    await chooseFile();

    await userEvent.click(screen.getByRole("button", { name: "Upload file" }));

    await waitFor(() =>
      expect(screen.getByTestId("import-result")).toBeInTheDocument(),
    );
    expect(screen.getByText("2 vehicles imported.")).toBeInTheDocument();
    expect(mocks.recent.add).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", fileName: "vehicles.csv" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("import-result-heading")).toHaveFocus(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Search a plate" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/map" });
  });

  it("announces the parse phase and a ready preview", () => {
    mocks.preview = { state: "parsing", preview: null, issue: null };
    const { rerender } = view(<ImportPage />);
    expect(screen.getByTestId("import-status")).toHaveTextContent(
      "Reading file…",
    );

    mocks.preview = { state: "ready", preview, issue: null };
    rerender(
      <TooltipProvider>
        <ToastProvider>
          <ImportPage />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByTestId("import-status")).toHaveTextContent(
      "File ready to upload.",
    );
  });

  it("announces cancellation without showing an error", async () => {
    mocks.preview = { state: "ready", preview, issue: null };
    mocks.upload = {
      ...mocks.upload,
      status: "cancelled",
      upload: vi.fn().mockResolvedValue({ status: "cancelled" }),
    };
    view(<ImportPage />);
    await chooseFile();
    await userEvent.click(screen.getByRole("button", { name: "Upload file" }));

    expect(screen.getByTestId("import-status")).toHaveTextContent(
      "Upload cancelled",
    );
    expect(screen.queryByTestId("import-failure")).not.toBeInTheDocument();
  });
});
