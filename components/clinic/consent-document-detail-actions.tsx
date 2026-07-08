"use client";

import { createConsentDraftVersionAction } from "@/lib/consent/actions";
import { ConsentArchiveDialog } from "@/components/clinic/consent-archive-dialog";
import { canShowArchiveAction, canShowNewDraftAction } from "@/lib/consent/clinic-ui";
import type { ConsentDocumentDetail } from "@/lib/consent/service";

export function ConsentDocumentDetailActions({
  document,
  canManage
}: {
  document: ConsentDocumentDetail;
  canManage: boolean;
}) {
  if (!canManage) {
    return null;
  }

  const showNewDraft = canShowNewDraftAction({
    status: document.status,
    versions: document.versions
  });
  const showArchive = canShowArchiveAction({
    status: document.status,
    versions: document.versions
  });

  if (!showNewDraft && !showArchive) {
    return null;
  }

  return (
    <div className="row-between">
      {showNewDraft ? (
        <form action={createConsentDraftVersionAction}>
          <input type="hidden" name="documentId" value={document.id} />
          <button className="button secondary" type="submit">
            Yeni versiyon başlat
          </button>
        </form>
      ) : (
        <span />
      )}
      {showArchive ? <ConsentArchiveDialog documentId={document.id} /> : null}
    </div>
  );
}
