#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWLIST_PATH_PREFIXES = [".env.example"];

const FORBIDDEN_TRACKED_PATH_PATTERNS = [
  /^\.env$/,
  /^\.env\.local$/,
  /^\.env\..+\.local$/,
  /^\.next\//,
  /^node_modules\//,
  /^test-results\//,
  /^playwright-report\//,
  /^coverage\//,
  /^\.supabase-home\//,
  /^supabase\/\.branches\//,
  /^supabase\/\.temp\//,
  /\.log$/,
  /\.pem$/,
  /\.p12$/,
  /\.key$/,
  /\.crt$/,
  /\.pfx$/
];

const FORBIDDEN_TRACKED_CONTENT_PATTERNS = [
  /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
  /\bsk_live_[0-9a-zA-Z]+\b/,
  /\bAKIA[0-9A-Z]{16}\b/
];

const CONTENT_SCAN_ALLOWLIST = [
  /^\.env\.example$/,
  /^docs\//,
  /^tests\//,
  /^supabase\/migrations\/frozen-manifest\.json$/,
  /^README\.md$/,
  /^SECURITY\.md$/
];

function fail(category, path) {
  console.error(`repository hygiene failed: ${category}: ${path}`);
  process.exit(1);
}

function listTrackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function isAllowlisted(path) {
  return ALLOWLIST_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function shouldScanContent(path) {
  if (isAllowlisted(path)) {
    return false;
  }
  return !CONTENT_SCAN_ALLOWLIST.some((pattern) => pattern.test(path));
}

function main() {
  const tracked = listTrackedFiles();

  for (const path of tracked) {
    if (isAllowlisted(path)) {
      continue;
    }

    if (FORBIDDEN_TRACKED_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
      fail("forbidden tracked path", path);
    }

    if (!shouldScanContent(path)) {
      continue;
    }

    let content;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }

    for (const pattern of FORBIDDEN_TRACKED_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        fail("forbidden tracked content pattern", path);
      }
    }
  }

  console.log(`repository hygiene pass (${tracked.length} tracked paths checked)`);
}

main();
