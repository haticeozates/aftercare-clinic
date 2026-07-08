import { listPlanCreateOptions } from "@/lib/plans/service";
import { PlanForm } from "./plan-form";

export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  const options = await listPlanCreateOptions();

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Yeni bakım planı</p>
        <h1>Yayınlanmış şablondan plan oluştur</h1>
        <p>Danışan için onaylanmış bakım şablonlarından güvenli bir takip planı oluşturun.</p>
      </div>
      <PlanForm options={options} />
    </section>
  );
}
