import { redirect } from "next/navigation";
import Link from "next/link";
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
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">AfterCare Clinic Platform</p>
        <h1>Production temel ortamı</h1>
      </div>
      <div className="panel stack">
        <p>
          Aktif organizasyon: <strong>{context.organization.name}</strong>
        </p>
        <p>
          Faz 2 kapsamı: tenant güvenli danışan ve işlem yönetimi. Bakım planı,
          danışan portalı, fotoğraf, belirti, consent ve WhatsApp modülleri henüz yok.
        </p>
        <div className="button-row">
          <Link className="button" href="/clinic/clients">
            Danışanları aç
          </Link>
          <Link className="button secondary" href="/clinic/procedures">
            İşlemleri aç
          </Link>
        </div>
      </div>
    </section>
  );
}
