"use client";

export default function NotificationError({ reset }: { reset: () => void }) {
  return <section className="page-section panel stack"><h1>Bildirim merkezi</h1>
    <p role="alert">Bildirimler şu anda yüklenemedi.</p><button className="button" onClick={reset}>Tekrar dene</button>
  </section>;
}
