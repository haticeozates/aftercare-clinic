import { requireOrganizationPermission } from "@/lib/auth/server";
import { createConsentDocumentAction } from "@/lib/consent/actions";

export const dynamic = "force-dynamic";

export default async function NewConsentDocumentPage() {
  await requireOrganizationPermission("consent.manage");

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Yeni Taslak</p>
        <h1>Belge taslağı oluştur</h1>
        <p>Yeni bir onay veya bilgilendirme belgesi oluşturun.</p>
      </div>

      <form className="panel stack" action={createConsentDocumentAction}>
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
          <input name="initialDraftTitle" placeholder="Temsili bilgilendirme v1" required />
        </label>
        <label>
          Özet
          <input name="initialDraftSummary" placeholder="Bu belge gerçek bir hukuki metin değildir." />
        </label>
        <label>
          Belge metni
          <textarea
            name="initialDraftBody"
            rows={5}
            placeholder="Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir."
            required
          />
        </label>
        <button className="button" type="submit">
          Taslak oluştur
        </button>
      </form>
    </section>
  );
}
