"use client";

import { useActionState } from "react";
import { updateConsentDraftVersionFormAction, type ConsentActionState } from "@/lib/consent/actions";
import { ConsentPublishDialog } from "@/components/clinic/consent-publish-dialog";
import { isDraftEditable, isPublishedReadonly } from "@/lib/consent/clinic-ui";
import type { ConsentVersionItem } from "@/lib/consent/service";

const initialState: ConsentActionState = {};

export function ConsentVersionPanel({
  version,
  documentId,
  documentStatus,
  canManage
}: {
  version: ConsentVersionItem;
  documentId: string;
  documentStatus: "active" | "inactive" | "archived";
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(updateConsentDraftVersionFormAction, initialState);
  const editable = isDraftEditable(version.status, canManage, documentStatus);
  const readonly = isPublishedReadonly(version.status);

  return (
    <article className="item-card stack">
      <div>
        <h2>
          v{version.versionNumber} · {version.titleSnapshot}
        </h2>
        <p>{version.summaryText ?? "Özet eklenmedi."}</p>
      </div>

      {editable ? (
        <form action={action} className="stack">
          <input type="hidden" name="versionId" value={version.id} />
          <input type="hidden" name="documentId" value={documentId} />
          <label>
            Versiyon başlığı
            <input name="titleSnapshot" defaultValue={version.titleSnapshot} required />
          </label>
          <label>
            Özet
            <textarea name="summaryText" rows={2} defaultValue={version.summaryText ?? ""} />
          </label>
          <label>
            Belge metni
            <textarea name="bodyText" rows={6} defaultValue={version.bodyText ?? ""} required />
          </label>
          {state.error ? (
            <p className="form-error" role="alert" aria-live="polite">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="form-success" role="status" aria-live="polite">
              {state.success}
            </p>
          ) : null}
          <div className="row-between">
            <button className="button secondary" type="submit" disabled={pending}>
              {pending ? "Kaydediliyor..." : "Taslağı kaydet"}
            </button>
          </div>
        </form>
      ) : null}

      {editable ? (
        <div className="row-end">
          <ConsentPublishDialog versionId={version.id} documentId={documentId} />
        </div>
      ) : null}

      {readonly || (!editable && version.bodyText) ? (
        <section aria-label="Belge metni">
          <p className="eyebrow">Belge metni</p>
          <div className="consent-body-readonly whitespace-pre-wrap">
            {version.bodyText ?? "Belge metni bulunamadı."}
          </div>
        </section>
      ) : null}

      {!editable && !readonly && !version.bodyText ? (
        <p className="muted">Bu versiyon için görüntülenecek belge metni yok.</p>
      ) : null}
    </article>
  );
}
