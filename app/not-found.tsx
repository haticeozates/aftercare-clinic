import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-shell">
      <section className="login-card stack">
        <p className="eyebrow">AfterCare Clinic</p>
        <h1>Sayfa bulunamadı</h1>
        <p>Aradığınız ekran mevcut değil veya erişim izniniz bulunmuyor.</p>
        <div className="button-row">
          <Link className="button" href="/login">
            Giriş ekranına dön
          </Link>
          <Link className="button secondary" href="/clinic">
            Klinik paneline git
          </Link>
        </div>
      </section>
    </main>
  );
}
