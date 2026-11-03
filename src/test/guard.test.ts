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
      'export const Bad = () => <div className="bg-zinc-100 p-[13px]" />;\nexport default Bad;\n',
    );
    const result = spawnSync("bash", ["scripts/guard.sh", directory], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("GUARD FAIL: arbitrary Tailwind value");
    expect(result.stdout).toContain("GUARD FAIL: raw palette class");
    expect(result.stdout).toContain("GUARD FAIL: default export");
  });

  it("passes on the repository source", () => {
    const result = spawnSync("bash", ["scripts/guard.sh"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
