import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizePortalPhotoUpload } from "@/lib/photos/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const finalizeSchema = z.object({
  intentId: z.string().uuid()
});

export async function POST(request: Request) {
  const parsed = finalizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Yükleme tamamlanamadı. Lütfen tekrar deneyin." }, { status: 400 });
  }

  const result = await finalizePortalPhotoUpload(parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
