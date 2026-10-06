import { checkPortalTaskMutationRateLimit } from "@/lib/portal";
import { updatePortalTaskStatus } from "@/lib/portal/service";
import {
  buildRateLimitedPortalJsonResponse,
  buildStoreUnavailablePortalJsonResponse
} from "@/lib/rate-limit/responses";
import { sensitiveJsonResponse } from "@/lib/security/sensitive-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimit = await checkPortalTaskMutationRateLimit(request);
  if (!rateLimit.allowed) {
    if (rateLimit.reason === "store_unavailable") {
      return buildStoreUnavailablePortalJsonResponse();
    }

    return buildRateLimitedPortalJsonResponse(rateLimit);
  }

  const body = (await request.json().catch(() => null)) as { taskId?: string; status?: string } | null;
  const status = body?.status === "pending" || body?.status === "completed" ? body.status : null;
  if (!body?.taskId || !status) {
    return sensitiveJsonResponse({ error: "İşlem tamamlanamadı." }, { status: 400 });
  }

  const result = await updatePortalTaskStatus(body.taskId, status);
  if (result.error) {
    return sensitiveJsonResponse({ error: result.error }, { status: 403 });
  }

  return sensitiveJsonResponse({ ok: true });
}
