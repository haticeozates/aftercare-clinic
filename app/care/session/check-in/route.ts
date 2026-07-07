import { NextResponse } from "next/server";
import { z } from "zod";
import { submitPortalCheckIn } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

const checkInSchema = z.object({
  dayId: z.string().uuid(),
  items: z.array(
    z.object({
      optionId: z.string().uuid(),
      selected: z.boolean(),
      severity: z.number().int().min(1).max(5).nullable().optional()
    })
  )
});

export async function POST(request: Request) {
  const parsed = checkInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bildiriminiz kaydedilemedi. Lütfen sayfayı yenileyin." }, { status: 400 });
  }

  const result = await submitPortalCheckIn(parsed.data.dayId, parsed.data.items);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({
    status: result.status,
    message: "Bildiriminiz kliniğinizin değerlendirmesi için kaydedildi."
  });
}
