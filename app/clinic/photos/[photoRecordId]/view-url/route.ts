import { NextResponse } from "next/server";
import { z } from "zod";
import { requestClinicPhotoViewUrl } from "@/lib/photos/clinic-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  photoRecordId: z.string().uuid()
});

export async function POST(_request: Request, { params }: { params: Promise<{ photoRecordId: string }> }) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Fotoğraf kaydı bulunamadı." },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  const result = await requestClinicPhotoViewUrl(parsed.data.photoRecordId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      {
        status: result.status,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
