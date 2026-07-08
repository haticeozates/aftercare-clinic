import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { runPhotoCleanupJob } from "@/lib/photos/cleanup/job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["dry_run", "execute"]).default("dry_run")
});

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function isAuthorized(request: Request) {
  const secret = getServerEnv().PHOTO_CLEANUP_SECRET;
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

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return noStoreJson({ error: "Cleanup isteği geçersiz." }, 400);
  }

  const result = await runPhotoCleanupJob(parsed.data.mode);

  return noStoreJson(result);
}
