import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPortalPhotoUploadIntent } from "@/lib/photos/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const intentSchema = z.object({
  photoRequestId: z.string().uuid(),
  declaredMime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(1).max(5 * 1024 * 1024)
});

export async function POST(request: Request) {
  const parsed = intentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Yükleme tamamlanamadı. Lütfen tekrar deneyin." }, { status: 400 });
  }

  const result = await requestPortalPhotoUploadIntent(parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
