"use client";

import { LineIcon } from "@/components/ui/line-icon";
import { NoticeIcon } from "./notice-icon";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { descriptions, noticeHref, type Notice } from "@/lib/notifications/contracts";

export function NotificationBell({ items, unread, unavailable }: { items: Notice[]; unread: number; unavailable: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div className="notice-bell" ref={root} onKeyDown={(event) => {
      if (event.key !== "Escape" || !open) return;
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    }}>
      <button type="button" ref={button} className="icon-button notice-bell-button"
        aria-label={unavailable ? "Bildirimler" : `Bildirimler, ${unread} okunmamış`}
        aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>
        <LineIcon name="bell" size={19} />
        {unread > 0 && <span className="notice-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <section className="notice-popover" id={id} aria-label="Son bildirimler">
        <div className="notice-popover-header"><h2>Son bildirimler</h2>
          <Link ref={firstLink} href="/clinic/notifications" onClick={() => setOpen(false)}>Tümünü gör</Link></div>
        {unavailable ? <p role="status">Bildirimler şu anda yüklenemedi.</p> : items.length ? (
          <ul aria-label="Son bildirimler listesi">
            {items.map((item) => <li key={item.id}><Link className="notice-preview-row" href={noticeHref(item.kind, item.target_id)}
              onClick={() => setOpen(false)}>
              <NoticeIcon kind={item.kind} /><strong>{descriptions[item.kind][0]}</strong><span>{item.read_at ? "Okundu" : "Okunmadı"}</span>
            </Link></li>)}
          </ul>
        ) : <p>Henüz bildirim yok.</p>}
      </section>}
    </div>
  );
}
