"use client";

import { useActionState } from "react";
import { createLinkAction, rotateLinkAction, revokeLinkAction } from "@/lib/secure-links/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, FeedbackMessage, SubmitButton } from "@/components/ui";

function maskTokenPrefix(prefix: string | null | undefined) {
  if (!prefix) {
    return "•••";
  }
  return `${prefix.slice(0, 3)}...`;
}

export function LinkActions({
  planId,
  activeLink,
  canManage
}: {
  planId: string;
  activeLink: { id: string; tokenPrefix: string | null; expiresAt: string } | null;
  canManage: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(createLinkAction, {});
  const [rotateState, rotateAction, rotatePending] = useActionState(rotateLinkAction, {});
  const [revokeState, revokeAction, revokePending] = useActionState(revokeLinkAction, {});

  if (!canManage) {
    return <FeedbackMessage tone="info">Bu plan için güvenli bağlantı oluşturulamaz.</FeedbackMessage>;
  }

  const oneTimeLink = createPending || rotatePending ? null : (rotateState.link ?? createState.link);
  const revocableLinkId = rotateState.linkId ?? createState.linkId ?? activeLink?.id;
  const linkError = createState.error ?? rotateState.error ?? revokeState.error;

  return (
    <div className="panel stack">
      <h2>Güvenli bağlantı</h2>
      {activeLink && !revokeState.success ? (
        <p>
          Aktif bağlantı · {maskTokenPrefix(activeLink.tokenPrefix)} · Son tarih {activeLink.expiresAt}
        </p>
      ) : (
        <EmptyState title="Aktif bağlantı yok" description="Danışan portalına erişim için güvenli bağlantı oluşturun." />
      )}
      {revokeState.success ? <FeedbackMessage tone="success">Bağlantı iptal edildi.</FeedbackMessage> : null}
      {oneTimeLink ? (
        <p className="notice" data-testid="plain-secure-link" role="status" aria-live="polite">
          {oneTimeLink}
        </p>
      ) : null}
      {linkError ? <FeedbackMessage tone="error">{linkError}</FeedbackMessage> : null}
      <div className="button-row link-actions-row">
        <form action={createAction}>
          <input type="hidden" name="planId" value={planId} />
          <SubmitButton pendingLabel="Oluşturuluyor...">Güvenli bağlantı oluştur</SubmitButton>
        </form>
        <ConfirmDialog
          triggerLabel="Bağlantıyı yenile"
          triggerClassName="button secondary"
          dialogTitle="Güvenli bağlantıyı yenile"
          dialogDescription="Yeni bağlantı oluşturulduğunda mevcut danışan bağlantısı geçersiz olur. Danışana yeni bağlantıyı ayrıca iletmeniz gerekir."
          confirmLabel="Evet, bağlantıyı yenile"
          formAction={rotateAction}
          pending={rotatePending}
          error={rotateState.error}
        >
          <input type="hidden" name="planId" value={planId} />
        </ConfirmDialog>
        {revocableLinkId && !revokeState.success ? (
          <ConfirmDialog
            triggerLabel="Bağlantıyı iptal et"
            triggerClassName="button secondary"
            dialogTitle="Güvenli bağlantıyı iptal et"
            dialogDescription="Bağlantı iptal edildiğinde danışan portalına erişim kapanır. Yeni erişim için bağlantı yeniden oluşturulmalıdır."
            confirmLabel="Evet, bağlantıyı iptal et"
            destructive
            formAction={revokeAction}
            pending={revokePending}
            error={revokeState.error}
            success={revokeState.success}
          >
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="linkId" value={revocableLinkId} />
          </ConfirmDialog>
        ) : null}
      </div>
    </div>
  );
}
