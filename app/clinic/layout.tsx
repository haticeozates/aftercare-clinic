import Link from "next/link";
import type { ReactNode } from "react";
import { requireActiveMembership } from "@/lib/auth/server";
import { signOutAction } from "@/lib/auth/actions";

export default async function ClinicLayout({ children }: { children: ReactNode }) {
  const context = await requireActiveMembership();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">AfterCare Clinic</p>
          <h2>Platform</h2>
          <p>{context.organization.name}</p>
        </div>
        <nav className="nav-list" aria-label="Klinik menüsü">
          <Link href="/clinic">Temel</Link>
          <Link href="/clinic/clients">Danışanlar</Link>
          <Link href="/clinic/procedures">İşlemler</Link>
          <Link href="/clinic/templates">Bakım Şablonları</Link>
          <Link href="/clinic/plans">Bakım Planları</Link>
        </nav>
        <form action={signOutAction}>
          <button className="button secondary" type="submit">
            Çıkış yap
          </button>
        </form>
      </aside>
      <main className="content-shell">{children}</main>
    </div>
  );
}
