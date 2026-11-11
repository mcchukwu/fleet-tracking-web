import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportResult } from "../types";
import { useImportVehicles } from "./import";

const mocks = vi.hoisted(() => ({
  importVehicles: vi.fn(),
}));

vi.mock("../instance", () => ({
  api: { importVehicles: mocks.importVehicles },
}));

const result: ImportResult = {
  job_id: "job-1",
  total: 2,
  imported: 2,
  failed: 0,
  errors: null,
};

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  mocks.importVehicles.mockReset();
});

describe("useImportVehicles", () => {
  it("returns the server result and invalidates every fleet-derived root", async () => {
    mocks.importVehicles.mockResolvedValue(result);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result: hook } = renderHook(() => useImportVehicles(), {
      wrapper: wrapper(queryClient),
    });

    await hook.current.mutateAsync({
      file: new File(["imei\n1"], "vehicles.csv"),
    });

    const roots = invalidate.mock.calls.map((call) =>
      JSON.stringify(call[0]?.queryKey),
    );
    expect(roots).toEqual(
      expect.arrayContaining([
        JSON.stringify(["vehicles"]),
        JSON.stringify(["vehicle"]),
        JSON.stringify(["live-snapshot"]),
        JSON.stringify(["drivers"]),
        JSON.stringify(["reports"]),
        JSON.stringify(["system-health"]),
      ]),
    );
    expect(roots).toHaveLength(6);
  });

  it("does not invalidate anything when the upload fails", async () => {
    mocks.importVehicles.mockRejectedValue(new Error("boom"));
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result: hook } = renderHook(() => useImportVehicles(), {
      wrapper: wrapper(queryClient),
    });

    await expect(
      hook.current.mutateAsync({ file: new File(["imei\n1"], "vehicles.csv") }),
    ).rejects.toThrow("boom");
    await waitFor(() => expect(hook.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
