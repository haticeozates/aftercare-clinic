"use client";

import { useActionState } from "react";
import { createLinkAction, rotateLinkAction, revokeLinkAction } from "@/lib/secure-links/actions";

function maskTokenPrefix(prefix: string | null | undefined) {
  if (!prefix) {
    return "•••";
  }
  return `${prefix.slice(0, 3)}...`;
}

export function LinkActions({
  planId,
  endDate,
  activeLink,
  canManage
}: {
  planId: string;
  endDate: string;
  activeLink: { id: string; tokenPrefix: string | null; expiresAt: string } | null;
  canManage: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(createLinkAction, {});
  const [rotateState, rotateAction, rotatePending] = useActionState(rotateLinkAction, {});
  const [revokeState, revokeAction, revokePending] = useActionState(revokeLinkAction, {});

  if (!canManage) {
    return <div className="notice">Bu plan için güvenli bağlantı oluşturulamaz.</div>;
  }

  const oneTimeLink = createPending || rotatePending ? null : (rotateState.link ?? createState.link);
  const revocableLinkId = rotateState.linkId ?? createState.linkId ?? activeLink?.id;

  return (
    <div className="panel stack">
      <h2>Güvenli bağlantı</h2>
      {activeLink && !revokeState.success ? (
        <p>
          Aktif bağlantı · {maskTokenPrefix(activeLink.tokenPrefix)} · Son tarih {activeLink.expiresAt}
        </p>
      ) : (
        <p>Aktif bağlantı yok.</p>
      )}
      {revokeState.success ? <p className="notice">Bağlantı iptal edildi.</p> : null}
      {oneTimeLink ? (
        <p className="notice" data-testid="plain-secure-link">
          {oneTimeLink}
        </p>
      ) : null}
      {createState.error || rotateState.error || revokeState.error ? (
        <p className="form-error" role="alert">
          {createState.error ?? rotateState.error ?? revokeState.error}
        </p>
      ) : null}
      <div className="button-row">
        <form action={createAction}>
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="endDate" value={endDate} />
          <button className="button" type="submit" disabled={createPending}>
            Güvenli bağlantı oluştur
          </button>
        </form>
        <form action={rotateAction}>
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="endDate" value={endDate} />
          <button className="button secondary" type="submit" disabled={rotatePending}>
            Bağlantıyı yenile
          </button>
        </form>
        {revocableLinkId && !revokeState.success ? (
          <form action={revokeAction}>
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="linkId" value={revocableLinkId} />
            <button className="button secondary" type="submit" disabled={revokePending}>
              Bağlantıyı iptal et
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
