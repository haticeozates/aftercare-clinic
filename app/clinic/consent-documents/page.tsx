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
        <h1>Onay ve bilgilendirme belgeleri</h1>
        <p>Belge versiyonlarını ve danışanlara atanacak temel kayıt altyapısını yönetin.</p>
      </div>

      {canManage ? (
        <form className="panel stack" action={createConsentDocumentAction}>
          <div className="section-header">
            <div>
              <p className="eyebrow">Yeni Taslak</p>
              <h2>Belge taslağı oluştur</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Belge kodu
              <input name="code" placeholder="local-notice" required />
            </label>
            <label>
              Başlık
              <input name="title" placeholder="Temsili bilgilendirme belgesi" required />
            </label>
            <label>
              Belge türü
              <select name="documentKind" defaultValue="notice">
                <option value="notice">Bilgilendirme</option>
                <option value="consent">Onay</option>
              </select>
            </label>
            <label>
              Amaç anahtarı
              <input name="purposeKey" placeholder="local_notice" required />
            </label>
          </div>
          <label>
            Versiyon başlığı
            <input name="titleSnapshot" placeholder="Temsili bilgilendirme v1" required />
          </label>
          <label>
            Özet
            <textarea name="summaryText" rows={2} placeholder="Bu belge gerçek bir hukuki metin değildir." />
          </label>
          <label>
            Belge metni
            <textarea
              name="bodyText"
              rows={5}
              placeholder="Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir."
              required
            />
          </label>
          <button className="button" type="submit">
            Taslak oluştur
          </button>
        </form>
      ) : null}

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
