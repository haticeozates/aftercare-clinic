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
        <p>Plan içeriği yayınlanmış versiyonun snapshot kopyasıdır; taslak içerikler seçilemez.</p>
      </div>
      <PlanForm options={options} />
    </section>
  );
}
