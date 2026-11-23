import { requireOrganizationPermission } from "@/lib/auth/server";
import { getAppointment } from "@/lib/appointments/service";
import { listPlanCreateOptions } from "@/lib/plans/service";
import { formatIstanbulIsoDate } from "@/lib/formatters";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ appointment?: string }> }) {
  const [{ appointment }, options] = await Promise.all([searchParams, listPlanCreateOptions()]);
  const clinic = appointment ? await requireOrganizationPermission("plan.create") : null;
  const source = appointment && clinic ? await getAppointment(clinic.organization.id, appointment) : null;
  const defaults = source?.status === "completed" && source.kind === "procedure" ? {
    client: options.clients.find((item) => item.id === source.client_id)?.id,
    procedure: options.procedures.find((item) => item.id === source.procedure_id)?.id
  } : undefined;

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Yeni bakım planı</p>
        <h1>Yayınlanmış şablondan plan oluştur</h1>
        <p>Danışan için onaylanmış bakım şablonlarından güvenli bir takip planı oluşturun.</p>
      </div>
      {defaults && <p>Danışan ve işlem, tamamlanmış randevudan aktarıldı. Planı oluşturmak için şablonu seçip onaylayın.</p>}
      <PlanForm options={options} startDate={formatIstanbulIsoDate()} defaults={defaults} />
    </section>
  );
}
