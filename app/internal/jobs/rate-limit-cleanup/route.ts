import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { runRateLimitCleanupJob } from "@/lib/rate-limit/cleanup/job";
import { mergeResponseHeaders, SENSITIVE_CACHE_CONTROL } from "@/lib/security/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: mergeResponseHeaders({ "Cache-Control": SENSITIVE_CACHE_CONTROL })
  });
}

function isAuthorized(request: Request) {
  const secret = getServerEnv().RATE_LIMIT_CLEANUP_SECRET;
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const headerBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);

  return headerBuffer.length === expectedBuffer.length && timingSafeEqual(headerBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return noStoreJson({ error: "Job yetkilendirmesi başarısız." }, 401);
  }

  const result = await runRateLimitCleanupJob();
  const status = result.status === "store_unavailable" ? 503 : 200;

  return noStoreJson(result, status);
}

export async function GET() {
  return noStoreJson({ error: "Job yetkilendirmesi başarısız." }, 405);
}
