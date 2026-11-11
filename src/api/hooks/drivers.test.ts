import { describe, expect, it } from "vitest";
import { queryKeys } from "../keys";
import { driversQueryOptions } from "./drivers";

describe("driversQueryOptions", () => {
  it("uses the shared drivers key and lets the page choose freshness", () => {
    const options = driversQueryOptions({ staleTime: 0, refetchOnWindowFocus: true });
    expect(options.queryKey).toEqual(queryKeys.drivers);
    expect(options.staleTime).toBe(0);
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(options.refetchInterval).toBeUndefined();
  });

  it("leaves the defaults untouched for every other caller", () => {
    const options = driversQueryOptions();
    expect(options.staleTime).toBeUndefined();
    expect(options.refetchOnWindowFocus).toBeUndefined();
    expect(options.enabled).toBeUndefined();
  });
});
