#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const IMAGE = "node:24-bookworm-slim";
const CLEAN_COMMAND = [
  "set -euo pipefail",
  "npm ci",
  "node -e \"require('sharp'); console.log('sharp ok')\"",
  "npm run typecheck",
  "npm run test:consent",
  "npm run test:clinic-consent",
  "npm run test:clinic-assignment",
  "npm run test:data-requests",
  "npm run test:rate-limit",
  "npm run build"
].join(" && ");

function main() {
  const mount = `${process.cwd()}:/workspace`;
  const result = spawnSync(
    "docker",
    ["run", "--rm", "-v", mount, "-w", "/workspace", IMAGE, "bash", "-lc", CLEAN_COMMAND],
    { stdio: "inherit" }
  );

  if (result.error) {
    console.error("linux node24 clean verification failed: docker is required");
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
