import { ConsentDocumentDetailActions } from "@/components/clinic/consent-document-detail-actions";
import { ConsentVersionPanel } from "@/components/clinic/consent-version-panel";
import {
  consentDocumentKindLabel,
  consentVersionStatusLabel,
  getConsentDocumentDetail
} from "@/lib/consent/service";
import { consentDocumentStatusLabel } from "@/lib/consent/clinic-ui";
import { formatDisplayDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function ConsentDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document, canManage } = await getConsentDocumentDetail(id);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Belge Detayı</p>
        <h1>{document.title}</h1>
        <p>
          {consentDocumentKindLabel(document.documentKind)} · {document.code} · {document.purposeKey}
        </p>
        <span className="badge">{consentDocumentStatusLabel(document.status)}</span>
        <span className="badge">{document.versionCount} versiyon</span>
        <span className="badge">Güncellendi: {formatDisplayDateTime(document.updatedAt)}</span>
      </div>

      <ConsentDocumentDetailActions document={document} canManage={canManage} />

      <div className="panel stack">
        <div className="section-header">
          <div>
            <p className="eyebrow">Versiyonlar</p>
            <h2>Belge versiyon geçmişi</h2>
          </div>
        </div>
        <div className="card-list">
          {document.versions.map((version) => (
            <div key={version.id} className="stack">
              <div className="row-between">
                <span className="badge">{consentVersionStatusLabel(version.status)}</span>
                <span className="badge">
                  {version.status === "published" && version.publishedAt
                    ? `Yayınlandı: ${formatDisplayDateTime(version.publishedAt)}`
                    : `Oluşturuldu: ${formatDisplayDateTime(version.createdAt)}`}
                </span>
              </div>
              <ConsentVersionPanel
                version={version}
                documentId={document.id}
                documentStatus={document.status}
                canManage={canManage}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
