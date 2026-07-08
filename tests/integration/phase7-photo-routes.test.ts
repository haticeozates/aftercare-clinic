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

  it("uses Node.js runtime and no-store cache for clinic photo view URL route", () => {
    const source = routeSource("app/clinic/photos/[photoRecordId]/view-url/route.ts");

    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain('"Cache-Control": "no-store"');
    expect(source).not.toContain("final_object_key");
    expect(source).not.toContain("care-photos");
  });

  it("keeps portal photo intent authorization behind the narrow RPC", () => {
    const source = routeSource("lib/photos/service.ts");

    expect(source).toContain("create_photo_upload_intent_for_portal");
    expect(source).not.toContain('.from("photo_requests")');
    expect(source).not.toContain('.from("portal_sessions")');
    expect(source).not.toContain('.from("care_plans")');
    expect(source).not.toContain('.from("photo_upload_intents")');
  });

  it("protects the internal photo cleanup route with Node runtime and no-store responses", () => {
    const source = routeSource("app/internal/jobs/photo-cleanup/route.ts");

    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain('"Cache-Control": "no-store"');
    expect(source).toContain("timingSafeEqual");
    expect(source).toContain("PHOTO_CLEANUP_SECRET");
    expect(source).toContain("export async function POST");
    expect(source).not.toContain("export async function GET");
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("final_object_key");
    expect(source).not.toContain("incoming_object_key");
  });
});
