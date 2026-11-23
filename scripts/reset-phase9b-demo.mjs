#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();

function fail(message) {
  console.error(`demo:reset failed: ${message}`);
  process.exit(1);
}

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) {
    fail(`${label} exited with code ${result.status ?? "unknown"}`);
  }
}

console.log(
  JSON.stringify({
    ok: true,
    action: "demo:reset",
    steps: ["db:reset", "demo:setup"],
    note: "Clean local reset then re-apply the deterministic Phase 9B demo fixture."
  })
);

run("db:reset", "npm", ["run", "db:reset"]);
run("demo:setup", "node", [resolve(root, "scripts/setup-phase9b-demo.mjs")]);
