#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

function parseArgs(argv) {
  const options = {
    manifestPath: "supabase/migrations/frozen-manifest.json",
    migrationsDir: "supabase/migrations"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      options.manifestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--migrations-dir") {
      options.migrationsDir = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function fail(message) {
  console.error(`migration integrity failed: ${message}`);
  process.exit(1);
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function migrationTimestamp(filename) {
  const match = basename(filename).match(/^(\d{14})/);
  if (!match) {
    fail(`invalid migration filename: ${filename}`);
  }
  return match[1];
}

function assertWithinRoot(rootDir, candidatePath) {
  const root = resolve(rootDir);
  const full = resolve(candidatePath);
  if (!full.startsWith(`${root}/`) && full !== root) {
    fail("unsafe migration path");
  }
  return full;
}

function loadManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    fail("frozen manifest is missing");
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    fail("frozen manifest is malformed");
  }

  if (!Array.isArray(manifest.migrations) || manifest.migrations.length === 0) {
    fail("frozen manifest has no migrations");
  }

  const seen = new Set();
  for (const entry of manifest.migrations) {
    if (!entry?.filename || !entry?.sha256) {
      fail("frozen manifest entry is incomplete");
    }
    if (seen.has(entry.filename)) {
      fail(`duplicate frozen manifest entry: ${entry.filename}`);
    }
    seen.add(entry.filename);
    if (entry.filename.includes("..") || entry.filename.includes("/") || entry.filename.includes("\\")) {
      fail("frozen manifest entry has an unsafe filename");
    }
  }

  return manifest;
}

function main() {
  const { manifestPath, migrationsDir } = parseArgs(process.argv.slice(2));
  const manifest = loadManifest(manifestPath);
  const migrationsRoot = assertWithinRoot(process.cwd(), migrationsDir);

  let latestFrozenTimestamp = "0";
  const frozenNames = new Set();

  for (const entry of manifest.migrations) {
    frozenNames.add(entry.filename);
    const timestamp = migrationTimestamp(entry.filename);
    if (timestamp > latestFrozenTimestamp) {
      latestFrozenTimestamp = timestamp;
    }

    const filePath = assertWithinRoot(migrationsRoot, resolve(migrationsRoot, entry.filename));
    if (!existsSync(filePath)) {
      fail(`frozen migration is missing: ${entry.filename}`);
    }

    const checksum = sha256File(filePath);
    if (checksum !== entry.sha256) {
      fail(`frozen migration checksum mismatch: ${entry.filename}`);
    }
  }

  const onDisk = readdirSync(migrationsRoot)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const filename of onDisk) {
    if (frozenNames.has(filename)) {
      continue;
    }

    const timestamp = migrationTimestamp(filename);
    if (timestamp <= latestFrozenTimestamp) {
      fail(`unexpected migration requires review: ${filename}`);
    }
  }

  console.log(`migration integrity pass (${manifest.migrations.length} frozen migrations verified)`);
}

main();
