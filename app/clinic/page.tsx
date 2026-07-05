import { redirect } from "next/navigation";
import { getCurrentOrganizationContext } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function ClinicFoundationPage() {
  const context = await getCurrentOrganizationContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "unauthorized") {
    redirect("/unauthorized");
  }

  return (
    <main className="shell">
      <section className="panel stack">
        <p className="eyebrow">AfterCare Clinic Platform</p>
        <h1>Production temel ortamı</h1>
        <p>
          Aktif organizasyon: <strong>{context.organization.name}</strong>
        </p>
        <p>
          Faz 0-1 kapsamı: auth temeli, organization membership, rol/izin modeli,
          tenant izolasyonu ve append-only audit altyapısı. Klinik operasyon modülleri
          henüz eklenmedi.
        </p>
      </section>
    </main>
  );
}
