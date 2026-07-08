"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const navItems = [
  { href: "/clinic", label: "Genel Bakış", icon: "⌂" },
  { href: "/clinic/clients", label: "Danışanlar", icon: "◌" },
  { href: "/clinic/procedures", label: "İşlemler", icon: "✦" },
  { href: "/clinic/templates", label: "Bakım Şablonları", icon: "▣" },
  { href: "/clinic/plans", label: "Bakım Planları", icon: "◎" },
  { href: "/clinic/alerts", label: "Takip Bildirimleri", icon: "!" },
  { href: "/clinic/consent-documents", label: "Onay Belgeleri", icon: "◍" },
  { href: "/clinic/data-requests", label: "Veri Talepleri", icon: "◇" }
];

function roleLabel(roleKey: string) {
  return {
    organization_owner: "İşletme sahibi",
    organization_admin: "Yönetici",
    staff: "Uzman"
  }[roleKey] ?? "Ekip üyesi";
}

function isActive(pathname: string, href: string) {
  if (href === "/clinic") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="nav-list" aria-label="Klinik menüsü">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link href={item.href} key={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ClinicShell({
  organizationName,
  roleKey,
  appEnv,
  signOutAction,
  children
}: {
  organizationName: string;
  roleKey: string;
  appEnv: string;
  signOutAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            AC
          </span>
          <div>
            <p className="eyebrow">AfterCare Clinic</p>
            <h2>{organizationName}</h2>
          </div>
        </div>
        <div className="role-card">
          <span>Rol</span>
          <strong>{roleLabel(roleKey)}</strong>
          {appEnv === "local" ? <em>Yerel test ortamı</em> : null}
        </div>
        <Navigation />
        <form action={signOutAction} className="sidebar-footer">
          <button className="ui-button ui-button--secondary" type="submit">
            Çıkış yap
          </button>
        </form>
      </aside>

      <header className="mobile-topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            AC
          </span>
          <div>
            <p className="eyebrow">AfterCare Clinic</p>
            <strong>{organizationName}</strong>
          </div>
        </div>
        <button className="icon-button" type="button" aria-label="Menüyü aç" onClick={() => setOpen(true)}>
          ☰
        </button>
      </header>

      {open ? (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <div
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Klinik menüsü"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-between">
              <div>
                <p className="eyebrow">Menü</p>
                <h2>{organizationName}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Menüyü kapat" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <Navigation onNavigate={() => setOpen(false)} />
            <form action={signOutAction}>
              <button className="ui-button ui-button--secondary" type="submit">
                Çıkış yap
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <main className="content-shell">{children}</main>
    </div>
  );
}
