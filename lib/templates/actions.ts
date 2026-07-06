"use server";

import { redirect } from "next/navigation";
import {
  addAlertRuleToDraft,
  addDayToDraft,
  addSymptomOptionToDraft,
  addTaskToDraft,
  createDraftFromPublished,
  insertTemplateFromForm,
  publishDraftVersion
} from "@/lib/templates/service";

export interface TemplateActionState {
  error?: string;
}

export async function createTemplateFormAction(
  _previous: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  let result: { templateId: string; versionId: string };
  try {
    result = await insertTemplateFromForm(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Bakım şablonu oluşturulamadı." };
  }

  redirect(`/clinic/templates/${result.templateId}/draft`);
}

export async function createDraftFromPublishedAction(formData: FormData) {
  await createDraftFromPublished(String(formData.get("templateId") ?? ""));
}

export async function addDayAction(
  _previous: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  try {
    await addDayToDraft(formData);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gün eklenemedi." };
  }
}

export async function addTaskAction(
  _previous: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  try {
    await addTaskToDraft(formData);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Görev eklenemedi." };
  }
}

export async function addSymptomOptionAction(
  _previous: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  try {
    await addSymptomOptionToDraft(formData);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Belirti seçeneği eklenemedi." };
  }
}

export async function addAlertRuleAction(
  _previous: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  try {
    await addAlertRuleToDraft(formData);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Takip kuralı eklenemedi." };
  }
}

export async function publishDraftFormAction(
  _previous: TemplateActionState,
  formData: FormData
): Promise<TemplateActionState> {
  let result: { templateId: string | null; versionId: string };
  try {
    result = await publishDraftVersion(String(formData.get("versionId") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Taslak yayına alınamadı." };
  }

  redirect(`/clinic/templates/${result.templateId ?? String(formData.get("templateId") ?? "")}/versions/${result.versionId}`);
}
