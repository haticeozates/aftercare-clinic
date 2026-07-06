import Link from "next/link";
import type { ReactNode } from "react";

export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">AfterCare Clinic</p>
          <h2>Platform</h2>
        </div>
        <nav className="nav-list" aria-label="Klinik menüsü">
          <Link href="/clinic">Temel</Link>
          <Link href="/clinic/clients">Danışanlar</Link>
          <Link href="/clinic/procedures">İşlemler</Link>
        </nav>
      </aside>
      <main className="content-shell">{children}</main>
    </div>
  );
}
