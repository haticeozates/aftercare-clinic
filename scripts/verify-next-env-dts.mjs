#!/usr/bin/env node

import { readFileSync } from "node:fs";

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
  const current = normalizeNewlines(readFileSync("next-env.d.ts", "utf8"));
  const canonical = normalizeNewlines(CANONICAL_NEXT_ENV);

  if (current !== canonical) {
    console.error("next-env.d.ts failed: tracked content does not match canonical template");
    process.exit(1);
  }

  console.log("next-env.d.ts pass");
}

main();
