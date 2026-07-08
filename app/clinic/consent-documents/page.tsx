import Link from "next/link";
import { createConsentDocumentAction } from "@/lib/consent/actions";
import { consentDocumentKindLabel, consentVersionStatusLabel, listConsentDocuments } from "@/lib/consent/service";

export const dynamic = "force-dynamic";

export default async function ConsentDocumentsPage() {
  const { documents, canManage } = await listConsentDocuments();

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Onay ve Bilgilendirme</p>
        <h1>Aydınlatma ve Onay Belgeleri</h1>
        <p>Belge versiyonlarını ve danışanlara atanacak temel kayıt altyapısını yönetin.</p>
        {canManage ? (
          <Link href="/clinic/consent-documents/new" className="button">
            Yeni Belge Ekle
          </Link>
        ) : null}
      </div>

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
                  <span className="badge">{document.status === "active" ? "Aktif" : "Pasif"}</span>
                  {document.latestVersionStatus ? (
                    <span className="badge">{consentVersionStatusLabel(document.latestVersionStatus)}</span>
                  ) : null}
                  <span className="badge">{document.versionCount} versiyon</span>
                </div>
                <Link className="button secondary" href={`/clinic/consent-documents/${document.id}`}>
                  Detay
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
