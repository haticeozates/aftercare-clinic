import { NextResponse } from "next/server";
import { requireActiveMembership } from "@/lib/auth/server";
import { hasPermission } from "@/lib/authorization";
import { writeAuditEvent } from "@/lib/audit";
import { archiveClient } from "@/lib/clients/service";

export async function POST(request: Request) {
  const context = await requireActiveMembership();
  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");

  if (!hasPermission(context.membership, "client.archive")) {
    await writeAuditEvent({
      organizationId: context.organization.id,
      actorType: "user",
      actorUserId: context.user.id,
      action: "client.archive_denied",
      entityType: "client",
      entityId: id || null,
      result: "denied",
      safeMetadata: { reason: "permission_denied", permission_key: "client.archive" }
    });

    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await archiveClient(id);
  return NextResponse.json({ ok: true });
}
