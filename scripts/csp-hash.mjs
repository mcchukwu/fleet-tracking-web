#!/usr/bin/env node
// Computes the CSP hash for the pre-paint theme bootstrap in index.html.
// Both the browser hash and the CSP source are over the exact bytes between
// <script> and </script>; formatting the script changes the hash.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) {
  console.error("index.html has no inline <script> to hash.");
  process.exit(1);
}

const hash = createHash("sha256").update(match[1], "utf8").digest("base64");
console.log(`'sha256-${hash}'`);
console.log("");
console.log("Use it in the recommended policy:");
console.log(`script-src 'self' 'sha256-${hash}';`);
