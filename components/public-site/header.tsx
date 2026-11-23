"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { mainLinks } from "@/lib/public-site/content";

export function PublicHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="ac-header"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="ac-wrap ac-header-inner">
        <Link
          className="ac-brand"
          href="/"
          onClick={() => setOpen(false)}
          aria-label="AfterCare Clinic ana sayfa"
        >
          <span className="ac-mark" aria-hidden="true">
            AC
          </span>
          <span>
            AfterCare <strong>Clinic</strong>
          </span>
        </Link>
        <button
          type="button"
          className="ac-menu"
          aria-expanded={open}
          aria-controls="public-navigation"
          ref={toggle}
          onClick={() => setOpen(!open)}
        >
          {open ? "Menüyü kapat" : "Menü"}{" "}
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <nav
          className="ac-nav"
          id="public-navigation"
          aria-label="Ana menü"
          data-open={open}
        >
          {mainLinks.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="ac-nav-actions">
            <Link href="/login" onClick={() => setOpen(false)}>
              Klinik girişi
            </Link>
            <Link
              href="/demo"
              className="ac-button ac-button-primary"
              onClick={() => setOpen(false)}
            >
              Demo talep et <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
