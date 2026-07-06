import { NextResponse } from "next/server";
import { checkPortalTaskMutationRateLimit } from "@/lib/portal";
import { updatePortalTaskStatus } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimit = checkPortalTaskMutationRateLimit({ route: "/care/session/tasks" });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { taskId?: string; status?: string } | null;
  const status = body?.status === "pending" || body?.status === "completed" ? body.status : null;
  if (!body?.taskId || !status) {
    return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 400 });
  }

  const result = await updatePortalTaskStatus(body.taskId, status);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
