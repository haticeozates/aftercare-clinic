"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { archiveClientFormAction } from "@/lib/clients/actions";

export function ArchiveClientDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [state, action, pending] = useActionState(archiveClientFormAction, {});

  return (
    <ConfirmDialog
      triggerLabel="Arşivle"
      triggerClassName="button danger"
      dialogTitle="Danışanı arşivle"
      dialogDescription={`${clientName} arşivlendiğinde aktif kayıt listelerinde görünmez. Gerekirse kaydı daha sonra yeniden açabilirsiniz.`}
      confirmLabel="Evet, arşivle"
      destructive
      formAction={action}
      pending={pending}
      error={state.error}
      success={state.success}
    >
      <input type="hidden" name="id" value={clientId} />
    </ConfirmDialog>
  );
}
