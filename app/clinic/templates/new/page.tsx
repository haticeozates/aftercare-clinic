import { listActiveProcedureOptions } from "@/lib/templates/service";
import { TemplateForm } from "./template-form";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const procedures = await listActiveProcedureOptions();

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Yeni şablon</p>
        <h1>Taslak bakım şablonu oluştur</h1>
        <p>Bu ekranda gerçek bakım talimatı değil, klinik tarafından sonradan yapılandırılacak temsili yapı oluşturulur.</p>
      </div>
      <TemplateForm procedures={procedures} />
    </section>
  );
}
