"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="tr">
      <body>
        <main className="login-shell">
          <section className="login-card stack">
            <p className="eyebrow">AfterCare Clinic</p>
            <h1>Beklenmeyen bir sorun oluştu</h1>
            <p>İşlem tamamlanamadı. Lütfen tekrar deneyin veya güvenli bir ekrana dönün.</p>
            <div className="button-row">
              <button className="button" type="button" onClick={reset}>
                Tekrar dene
              </button>
              <Link className="button secondary" href="/login">
                Giriş ekranına dön
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
