import { requireOrganizationPermission } from "@/lib/auth/server";
import { ConsentDocumentCreateForm } from "@/components/clinic/consent-document-create-form";

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

      <ConsentDocumentCreateForm />
    </section>
  );
}
