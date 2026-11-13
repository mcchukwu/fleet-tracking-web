#!/usr/bin/env node
// Records ~30 seconds of the staging live feed and prints only counts and field
// names. The sanitised capture lands in test-results/live-capture.json.
//   FLEET_STAGING_EMAIL=… FLEET_STAGING_PASSWORD=… npm run capture:live
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = (
  process.env.FLEET_STAGING_BASE_URL ?? "https://fleet-demo.165-232-96-216.sslip.io"
).replace(/\/$/, "");
const email = process.env.FLEET_STAGING_EMAIL;
const password = process.env.FLEET_STAGING_PASSWORD;
const seconds = Number(process.env.FLEET_CAPTURE_SECONDS ?? 30);

if (!email || !password) {
  console.error("capture:live requires FLEET_STAGING_EMAIL and FLEET_STAGING_PASSWORD.");
  process.exit(1);
}

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ["--no-sandbox"] }
    : {},
);

try {
  const context = await browser.newContext();
  const response = await context.request.post(`${base}/api/v1/auth/login`, {
    data: { email, password },
  });
  if (!response.ok()) {
    console.error(`capture:live login failed with ${response.status()}`);
    process.exit(1);
  }

  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });

  const summary = await page.evaluate(async (durationSeconds) => {
    return await new Promise((resolve) => {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${location.host}/api/v1/live/ws`);
      const byType = {};
      let total = 0;
      let parseErrors = 0;
      const finish = () => {
        try {
          socket.close();
        } catch {
          // The socket may already be closed by the server.
        }
        resolve({ total, parseErrors, byType });
      };
      const timer = setTimeout(finish, durationSeconds * 1000);
      socket.onmessage = (event) => {
        total += 1;
        let message;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          parseErrors += 1;
          return;
        }
        const type = typeof message?.type === "string" ? message.type : "unknown";
        const entry = (byType[type] ??= { count: 0, fields: [] });
        entry.count += 1;
        for (const key of Object.keys(message)) {
          if (!entry.fields.includes(key)) entry.fields.push(key);
        }
        entry.fields.sort();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        finish();
      };
    });
  }, seconds);

  const capture = {
    capturedAt: new Date().toISOString(),
    base,
    seconds,
    total: summary.total,
    parseErrors: summary.parseErrors,
    byType: summary.byType,
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/live-capture.json", `${JSON.stringify(capture, null, 2)}\n`);

  console.log(
    `captured ${summary.total} frames in ${seconds}s (${summary.parseErrors} parse errors)`,
  );
  for (const [type, entry] of Object.entries(summary.byType)) {
    console.log(`  ${type}: ${entry.count} frames · ${entry.fields.join(", ")}`);
  }
  console.log("wrote test-results/live-capture.json (values omitted)");
} finally {
  await browser.close();
}
