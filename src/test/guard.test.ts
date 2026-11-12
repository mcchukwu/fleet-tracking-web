import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const directory = mkdtempSync(join(tmpdir(), "fleet-guard-"));

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("design guard", () => {
  it("fails on a deliberately bad sample", () => {
    writeFileSync(
      join(directory, "sample.tsx"),
      'import { useCan } from "./useCan";\nimport { layers } from "@protomaps/basemaps";\nexport const Bad = () => <div className="bg-zinc-100 p-[13px] z-50 min-h-screen" />;\nexport const online = navigator.onLine;\nexport const can = useCan("mutate");\nexport const tiles = layers;\nexport const pending = vehiclesQuery.isPending;\nexport default Bad;\n',
    );
    const result = spawnSync("bash", ["scripts/guard.sh", directory], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("GUARD FAIL: arbitrary Tailwind value");
    expect(result.stdout).toContain("GUARD FAIL: raw palette class");
    expect(result.stdout).toContain("GUARD FAIL: default export");
    expect(result.stdout).toContain("GUARD FAIL: viewport unit");
    expect(result.stdout).toContain("GUARD FAIL: query isPending outside useQueryView");
    expect(result.stdout).toContain(
      "GUARD FAIL: numeric or arbitrary z-index outside src/ui/layers.css",
    );
    expect(result.stdout).toContain("GUARD FAIL: mutating capability outside useCanMutate");
    expect(result.stdout).toContain("GUARD FAIL: navigator.onLine outside the connection store");
    expect(result.stdout).toContain("GUARD FAIL: map SDK used outside src/map/providers");
  });

  it("passes a guard-ignore line with a reason", () => {
    const ignored = mkdtempSync(join(tmpdir(), "fleet-guard-ignore-"));
    try {
      writeFileSync(
        join(ignored, "sample.ts"),
        'export const pending = mutation.isPending; // guard-ignore: mutation pending is a write.\n',
      );
      const result = spawnSync("bash", ["scripts/guard.sh", ignored], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
      expect(result.status, result.stdout + result.stderr).toBe(0);
    } finally {
      rmSync(ignored, { recursive: true, force: true });
    }
  });

  it("passes on the repository source", () => {
    const result = spawnSync("bash", ["scripts/guard.sh"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
