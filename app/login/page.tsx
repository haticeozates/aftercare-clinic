import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            AC
          </span>
          <div>
            <p className="eyebrow">AfterCare Clinic</p>
            <strong>Clinical care operations</strong>
          </div>
        </div>
        <div className="stack">
          <h1>Klinik takip operasyonu için güvenli çalışma alanı</h1>
          <p>
            Bakım planları, günlük takipler ve klinik değerlendirme bildirimleri için
            sade ve kontrollü bir yönetim deneyimi.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
