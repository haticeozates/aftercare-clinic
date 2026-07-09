#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const CANONICAL_NEXT_ENV = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

function main() {
  const shouldFix = process.argv.includes("--fix");
  const current = normalizeNewlines(readFileSync("next-env.d.ts", "utf8"));
  const canonical = normalizeNewlines(CANONICAL_NEXT_ENV);

  if (current === canonical) {
    console.log("next-env.d.ts pass");
    return;
  }

  const devVariant = canonical.replace(
    'import "./.next/types/routes.d.ts";',
    'import "./.next/dev/types/routes.d.ts";'
  );

  if (current === devVariant && !shouldFix) {
    console.log("next-env.d.ts pass (dev import variant detected; normalize before production build)");
    return;
  }

  if (shouldFix) {
    writeFileSync("next-env.d.ts", canonical);
    console.log("next-env.d.ts normalized to production canonical template");
    return;
  }

  console.error("next-env.d.ts failed: tracked content does not match canonical template");
  process.exit(1);
}

main();
