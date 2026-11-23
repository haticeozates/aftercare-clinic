"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { stopPlanFormAction } from "@/lib/plans/actions";

export function StopPlanDialog({ planId, clientName }: { planId: string; clientName: string }) {
  const [state, action, pending] = useActionState(stopPlanFormAction, {});

  return (
    <ConfirmDialog
      triggerLabel="Planı durdur"
      triggerClassName="button secondary"
      dialogTitle="Bakım planını durdur"
      dialogDescription={`${clientName} için bu bakım planı durdurulduğunda danışan portalına erişim kapanır. Bu işlem geri alınamaz.`}
      confirmLabel="Evet, planı durdur"
      destructive
      formAction={action}
      pending={pending}
      error={state.error}
      success={state.success}
    >
      <input type="hidden" name="planId" value={planId} />
    </ConfirmDialog>
  );
}
