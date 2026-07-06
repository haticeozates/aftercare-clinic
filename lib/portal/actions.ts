"use server";

import { revalidatePath } from "next/cache";
import { updatePortalTaskStatus } from "@/lib/portal/service";

export type PortalTaskActionState = {
  error?: string;
  taskStatus?: "pending" | "completed";
};

export async function completePortalTaskAction(formData: FormData) {
  const result = await updatePortalTaskStatus(String(formData.get("taskId") ?? ""), "completed");
  revalidatePath("/care/session");
  return result;
}

export async function reopenPortalTaskAction(formData: FormData) {
  const result = await updatePortalTaskStatus(String(formData.get("taskId") ?? ""), "pending");
  revalidatePath("/care/session");
  return result;
}

export async function completePortalTaskFormAction(
  _previous: PortalTaskActionState,
  formData: FormData
): Promise<PortalTaskActionState> {
  const result = await completePortalTaskAction(formData);
  return result.error ? { error: result.error } : { taskStatus: "completed" };
}

export async function reopenPortalTaskFormAction(
  _previous: PortalTaskActionState,
  formData: FormData
): Promise<PortalTaskActionState> {
  const result = await reopenPortalTaskAction(formData);
  return result.error ? { error: result.error } : { taskStatus: "pending" };
}
