import { NextResponse } from "next/server";
import { requireActiveMembership } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { writeAuditEvent } from "@/lib/audit";
import { publishDraftVersion } from "@/lib/templates/service";

export async function POST(request: Request) {
  const context = await requireActiveMembership();
  const formData = await request.formData();
  const versionId = String(formData.get("versionId") ?? "");

  if (!hasPermission(context.membership, "template.publish")) {
    await writeAuditEvent({
      organizationId: context.organization.id,
      actorType: "user",
      actorUserId: context.user.id,
      action: "template.publish_denied",
      entityType: "template_version",
      entityId: versionId,
      result: "denied",
      safeMetadata: { reason: "permission_denied", permission_key: "template.publish", source: "route" }
    });
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  try {
    const result = await publishDraftVersion(versionId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Taslak yayına alınamadı." },
      { status: 400 }
    );
  }
}
