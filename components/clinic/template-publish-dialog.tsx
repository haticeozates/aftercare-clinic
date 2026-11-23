"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { publishDraftFormAction } from "@/lib/templates/actions";

export function TemplatePublishDialog({ versionId, templateId }: { versionId: string; templateId: string }) {
  const [state, action, pending] = useActionState(publishDraftFormAction, {});

  return (
    <ConfirmDialog
      triggerLabel="Yayına al"
      triggerClassName="button"
      dialogTitle="Taslak versiyonu yayına al"
      dialogDescription="Bu versiyon yayımlandıktan sonra değiştirilemez. Değişiklik için yeni bir taslak versiyon oluşturmanız gerekir."
      confirmLabel="Evet, yayına al"
      formAction={action}
      pending={pending}
      error={state.error}
    >
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="templateId" value={templateId} />
    </ConfirmDialog>
  );
}
