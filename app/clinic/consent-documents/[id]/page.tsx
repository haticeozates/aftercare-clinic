import { createConsentDraftVersionAction, publishConsentVersionAction } from "@/lib/consent/actions";
import {
  consentDocumentKindLabel,
  consentVersionStatusLabel,
  getConsentDocumentDetail
} from "@/lib/consent/service";
import { formatDisplayDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function ConsentDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, canManage } = await getConsentDocumentDetail(id);
  const hasDraft = document.versions.some((version) => version.status === "draft");
  const hasPublished = document.versions.some((version) => version.status === "published");

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Belge Detayı</p>
        <h1>{document.title}</h1>
        <p>
          {consentDocumentKindLabel(document.documentKind)} · {document.code} · {document.purposeKey}
        </p>
        <span className="badge">{document.status === "active" ? "Aktif" : "Pasif"}</span>
      </div>

      {canManage && hasPublished ? (
        <form action={createConsentDraftVersionAction}>
          <input type="hidden" name="documentId" value={document.id} />
          <button className="button secondary" type="submit" disabled={hasDraft}>
            Yeni versiyon başlat
          </button>
        </form>
      ) : null}

      <div className="panel stack">
        <div className="section-header">
          <div>
            <p className="eyebrow">Versiyonlar</p>
            <h2>Belge versiyon geçmişi</h2>
          </div>
        </div>
        <div className="card-list">
          {document.versions.map((version) => (
            <article className="item-card" key={version.id}>
              <div>
                <h2>
                  v{version.versionNumber} · {version.titleSnapshot}
                </h2>
                <p>{version.summaryText ?? "Özet eklenmedi."}</p>
                <span className="badge">{consentVersionStatusLabel(version.status)}</span>
                <span className="badge">{formatDisplayDateTime(version.publishedAt ?? version.createdAt)}</span>
              </div>
              {canManage && version.status === "draft" ? (
                <form action={publishConsentVersionAction} className="stack">
                  <input type="hidden" name="versionId" value={version.id} />
                  <details className="dropdown">
                    <summary className="button">Yayınla</summary>
                    <div className="dropdown-menu panel stack" style={{ padding: "1rem", marginTop: "0.5rem" }}>
                      <p>Bu işlemi onaylıyor musunuz?</p>
                      <button type="submit" className="button primary">Evet, Yayınla</button>
                    </div>
                  </details>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
