import { afterEach, describe, expect, it, vi } from "vitest";
import { registerPmtilesProtocol, resetPmtilesProtocolForTests } from "./pmtiles";

afterEach(() => {
  resetPmtilesProtocolForTests();
});

describe("PMTiles protocol", () => {
  it("registers the pmtiles handler once", () => {
    const register = vi.fn();

    registerPmtilesProtocol(register);
    registerPmtilesProtocol(register);

    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0]?.[0]).toBe("pmtiles");
    expect(typeof register.mock.calls[0]?.[1]).toBe("function");
  });
});
