import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function routeSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 7 photo upload route contracts", () => {
  it("uses Node.js runtime for signed upload intent and finalize routes", () => {
    expect(routeSource("app/care/session/photos/intents/route.ts")).toContain('export const runtime = "nodejs"');
    expect(routeSource("app/care/session/photos/finalize/route.ts")).toContain('export const runtime = "nodejs"');
  });

  it("keeps photo upload routes dynamic", () => {
    expect(routeSource("app/care/session/photos/intents/route.ts")).toContain('export const dynamic = "force-dynamic"');
    expect(routeSource("app/care/session/photos/finalize/route.ts")).toContain('export const dynamic = "force-dynamic"');
  });
});
