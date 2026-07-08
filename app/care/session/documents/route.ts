import { NextResponse } from "next/server";
import { z } from "zod";
import { portalDocumentEventSchema } from "@/lib/consent/portal-contracts";
import { recordPortalDocumentEvent } from "@/lib/consent/portal-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  assignmentId: z.string().uuid(),
  eventType: portalDocumentEventSchema
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tercihiniz kaydedilemedi. Lütfen tekrar deneyin." }, { status: 400 });
  }

  const result = await recordPortalDocumentEvent(parsed.data.assignmentId, parsed.data.eventType);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    currentDecision: result.currentDecision
  });
}
