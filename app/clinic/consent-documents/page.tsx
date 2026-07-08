import Link from "next/link";
import { ConsentDocumentCreateForm } from "@/components/clinic/consent-document-create-form";
import {
  consentDocumentKindLabel,
  consentVersionStatusLabel,
  listConsentDocuments
} from "@/lib/consent/service";
import { consentDocumentStatusLabel } from "@/lib/consent/clinic-ui";
import { formatDisplayDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function ConsentDocumentsPage() {
  const { documents, canManage } = await listConsentDocuments();

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Onay ve Bilgilendirme</p>
        <h1>Onay ve bilgilendirme belgeleri</h1>
        <p>Belge versiyonlarını ve danışanlara atanacak temel kayıt altyapısını yönetin.</p>
        {canManage ? (
          <Link href="/clinic/consent-documents/new" className="button secondary">
            Yeni belge sayfası
          </Link>
        ) : null}
      </div>

      {canManage ? <ConsentDocumentCreateForm /> : null}

      <div className="panel">
        {documents.length === 0 ? (
          <div className="empty-state">
            <h2>Belge bulunamadı</h2>
            <p>Henüz onay veya bilgilendirme belgesi oluşturulmadı.</p>
          </div>
        ) : (
          <div className="card-list">
            {documents.map((document) => (
              <article className="item-card" key={document.id}>
                <div>
                  <h2>{document.title}</h2>
                  <p>
                    {consentDocumentKindLabel(document.documentKind)} · {document.code} · {document.purposeKey}
                  </p>
                  <span className="badge">{consentDocumentStatusLabel(document.status)}</span>
                  {document.latestVersionStatus ? (
                    <span className="badge">{consentVersionStatusLabel(document.latestVersionStatus)}</span>
                  ) : null}
                  <span className="badge">{document.hasActiveDraft ? "Taslak var" : "Taslak yok"}</span>
                  {document.latestPublishedVersionNumber ? (
                    <span className="badge">Yayın v{document.latestPublishedVersionNumber}</span>
                  ) : null}
                  <span className="badge">{formatDisplayDateTime(document.updatedAt)}</span>
                </div>
                <div className="stack">
                  {canManage && document.hasActiveDraft ? (
                    <Link className="button secondary" href={`/clinic/consent-documents/${document.id}`}>
                      Taslağı düzenle
                    </Link>
                  ) : null}
                  <Link className="button secondary" href={`/clinic/consent-documents/${document.id}`}>
                    Detay
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
