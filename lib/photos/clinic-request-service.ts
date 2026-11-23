import "server-only";

import { revalidatePath } from "next/cache";
import { requireOrganizationPermission } from "@/lib/auth/server";
import {
  mapPhotoRequestRpcResult,
  parseCreatePhotoRequestInput
} from "@/lib/photos/clinic-request-contracts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PhotoRequestRpcPayload = {
  error?: string;
  status?: string;
  photo_request_id?: string;
};

function assertPhotoRequestRpcSuccess(
  transportError: { code?: string; message?: string } | null,
  rpcResult: PhotoRequestRpcPayload | null
): PhotoRequestRpcPayload {
  if (transportError || rpcResult?.error) {
    throw new Error(mapPhotoRequestRpcResult(transportError, rpcResult));
  }

  if (!rpcResult?.photo_request_id) {
    throw new Error(mapPhotoRequestRpcResult({ code: "UNKNOWN" }, null));
  }

  return rpcResult;
}

export async function createPhotoRequestFromForm(formData: FormData) {
  await requireOrganizationPermission("photo.request.manage");

  const parsed = parseCreatePhotoRequestInput({
    carePlanId: String(formData.get("carePlanId") ?? ""),
    carePlanDayId: String(formData.get("carePlanDayId") ?? ""),
    label: String(formData.get("label") ?? ""),
    required: formData.get("required")
  });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_photo_request_for_staff", {
    p_care_plan_id: parsed.carePlanId,
    p_care_plan_day_id: parsed.carePlanDayId,
    p_label: parsed.label,
    p_required: parsed.required
  });

  const result = assertPhotoRequestRpcSuccess(error, data as PhotoRequestRpcPayload | null);
  revalidatePath(`/clinic/plans/${parsed.carePlanId}`);
  return result.photo_request_id ?? "";
}
