#!/usr/bin/env node
// Prints the slowest tests from the Playwright JSON report.
// Usage: npm run e2e:slowest [-- 15]
import { readFileSync } from "node:fs";

const reportPath = process.env.PLAYWRIGHT_JSON_REPORT ?? "test-results/playwright-report.json";
const limit = Number(process.argv[2] ?? 10);

let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch {
  console.error(`Cannot read ${reportPath}. Run Playwright with the json reporter first.`);
  process.exit(1);
}

const rows = [];

function visitSuite(suite, parents) {
  const path = [...parents, suite.title].filter(Boolean);
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const duration = (test.results ?? []).reduce(
        (total, result) => total + (result.duration ?? 0),
        0,
      );
      rows.push({
        title: [...path, spec.title].filter(Boolean).join(" › "),
        project: test.projectName ?? "default",
        status: test.status ?? "unknown",
        duration,
      });
    }
  }
  for (const child of suite.suites ?? []) visitSuite(child, path);
}

for (const suite of report.suites ?? []) visitSuite(suite, []);

rows.sort((a, b) => b.duration - a.duration);

for (const row of rows.slice(0, limit)) {
  console.log(
    `${(row.duration / 1000).toFixed(1).padStart(6)}s  ${row.status.padEnd(8)} ${row.project}  ${row.title}`,
  );
}

const over30 = rows.filter((row) => row.duration > 30_000);
console.log(
  `\n${rows.length} results · ${rows.filter((row) => row.status !== "skipped").length} executed · ${over30.length} over 30s`,
);
if (over30.length > 0) {
  console.log("Add a docs/backlog.md item for every test above 30s.");
}
