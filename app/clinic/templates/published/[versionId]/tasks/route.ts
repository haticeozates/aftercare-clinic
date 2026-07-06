import { NextResponse } from "next/server";
import { requireActiveMembership } from "@/lib/auth/server";
import { writeAuditEvent } from "@/lib/audit";

export async function POST(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const context = await requireActiveMembership();
  const { versionId } = await params;

  await writeAuditEvent({
    organizationId: context.organization.id,
    actorType: "user",
    actorUserId: context.user.id,
    action: "template.immutable_change_denied",
    entityType: "template_version",
    entityId: versionId,
    result: "denied",
    safeMetadata: { reason: "published_version_immutable", source: "route" }
  });

  return NextResponse.json({ error: "Bu yayınlanmış versiyon değiştirilemez." }, { status: 403 });
}
