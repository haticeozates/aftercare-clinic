import { ClinicFields, DemoForm } from "@/components/phase11/forms";
import { Card, PageHeader } from "@/components/ui";
import { requireOrganizationPermission } from "@/lib/auth/server";
import { saveClinicAction } from "@/lib/phase11/clinic-actions";
import { getClinicDetails } from "@/lib/phase11/clinic-data";
import { requireClinicManagement } from "@/lib/phase11/server";
import "@/components/phase11/phase11.css";

export default async function ClinicSettingsPage() {
  requireClinicManagement();
  const actor = await requireOrganizationPermission("organization.update");
  const details = await getClinicDetails(actor.organization, actor.user.id);
  return (
    <section className="page-section stack phase11-management">
      <PageHeader eyebrow="Yönetim" title="Klinik ayarları" description="Organizasyon bilgilerinizi ve klinikte görünen adınızı düzenleyin." />
      <Card><DemoForm action={saveClinicAction} submit="Ayarları kaydet"><ClinicFields defaults={details} /></DemoForm></Card>
    </section>
  );
}
