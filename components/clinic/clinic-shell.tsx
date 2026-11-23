"use client";

import { LineIcon, type LineIconName } from "@/components/ui/line-icon";
import { NotificationBell } from "@/components/notifications/bell";
import type { notificationPreview } from "@/lib/notifications/service";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { trapTabFocus } from "@/lib/consent/clinic-ui";

type Destination = { href: string; label: string; icon: LineIconName };

const navGroups: { label: string; items: Destination[] }[] = [
  { label: "Klinik operasyonu", items: [
    { href: "/clinic", label: "Genel Bakış", icon: "home" },
    { href: "/clinic/appointments", label: "Randevular", icon: "calendar" },
    { href: "/clinic/clients", label: "Danışanlar", icon: "people" },
    { href: "/clinic/reports", label: "Raporlar ve Analitik", icon: "chart" },
  ] },
  { label: "Bakım ve takip", items: [
    { href: "/clinic/alerts", label: "Takip Bildirimleri", icon: "alert" },
    { href: "/clinic/plans", label: "Bakım Planları", icon: "plan" },
    { href: "/clinic/templates", label: "Bakım Şablonları", icon: "template" },
    { href: "/clinic/procedures", label: "İşlemler", icon: "procedure" },
    { href: "/clinic/consent-documents", label: "Onay Belgeleri", icon: "consent" },
    { href: "/clinic/data-requests", label: "Veri Talepleri", icon: "request" },
  ] },
];

const managementLinks: Destination[] = [
  { href: "/clinic/settings", label: "Klinik ayarları", icon: "settings" },
  { href: "/clinic/team", label: "Ekip yönetimi", icon: "people" },
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

function Navigation({ onNavigate, management }: { onNavigate?: () => void; management: boolean }) {
  const groups = management ? [...navGroups, { label: "Yönetim", items: managementLinks }] : navGroups;
  const pathname = usePathname();
  return (
    <nav className="nav-list" aria-label="Klinik menüsü">
      {groups.map(({ label, items }) => <div className="nav-group" key={label}>
        <p className="nav-group-label">{label}</p>
        {items.map((item) => (
          <Link href={item.href} key={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} onClick={onNavigate}>
            <LineIcon name={item.icon} size={18} />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>)}
    </nav>
  );
}

export function ClinicShell({
  organizationName,
  roleKey,
  appEnv,
  management = false,
  signOutAction,
  notices,
  children
}: {
  organizationName: string;
  roleKey: string;
  appEnv: string;
  management?: boolean;
  signOutAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  notices?: Awaited<ReturnType<typeof notificationPreview>>;
}) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const restoreMenuFocus = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const drawer = drawerRef.current;
    const closeButton = drawer?.querySelector<HTMLElement>('[aria-label="Menüyü kapat"]');
    (closeButton ?? drawer)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (drawerRef.current) {
        trapTabFocus(event, drawerRef.current);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open && restoreMenuFocus.current) {
      restoreMenuFocus.current = false;
      menuButtonRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#clinic-main-content">
        Ana içeriğe geç
      </a>
      <aside className="sidebar" aria-label="Klinik kenar çubuğu">
        <div className="notice-clinic-brand">
          <div className="brand-block">
            <span className="brand-mark" aria-hidden="true">AC</span>
            <div><p className="eyebrow">AfterCare Clinic</p><h2>{organizationName}</h2></div>
          </div>
          {notices && <NotificationBell {...notices} />}
        </div>
        <div className="role-card">
          <span>Rol</span>
          <strong>{roleLabel(roleKey)}</strong>
          {appEnv === "local" ? <em>Yerel test ortamı</em> : null}
        </div>
        <Navigation management={management} />
        <form action={signOutAction} className="sidebar-footer">
          <button className="ui-button ui-button--secondary" type="submit">
            <LineIcon name="exit" size={17} /> Çıkış yap
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
        <div className="notice-clinic-tools">
          {notices && <NotificationBell {...notices} />}
        <button
          ref={menuButtonRef}
          className="icon-button"
          type="button"
          aria-label="Menüyü aç"
          aria-expanded={open}
          aria-controls="clinic-mobile-drawer"
          onClick={() => { restoreMenuFocus.current = true; setOpen(true); }}
        >
          <LineIcon name="menu" />
        </button>
        </div>
      </header>

      {open ? (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <div
            id="clinic-mobile-drawer"
            ref={drawerRef}
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Klinik menüsü"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-between">
              <div>
                <p className="eyebrow">Menü</p>
                <h2>{organizationName}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Menüyü kapat" onClick={() => setOpen(false)}>
                <LineIcon name="close" />
              </button>
            </div>
            <Navigation management={management} onNavigate={() => setOpen(false)} />
            <form action={signOutAction}>
              <button className="ui-button ui-button--secondary" type="submit">
                <LineIcon name="exit" size={17} /> Çıkış yap
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <main id="clinic-main-content" className="content-shell" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
