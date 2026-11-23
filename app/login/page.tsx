import { phase11Config } from "@/lib/phase11/config";
import "@/components/phase11/phase11.css";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage({
  searchParams
}: { searchParams: Promise<{ parola?: string }> }) {
  const demo = phase11Config();
  const changed = demo && (await searchParams).parola === "guncellendi";
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            AC
          </span>
          <div>
            <p className="eyebrow">AfterCare Clinic</p>
            <strong>Klinik takip platformu</strong>
          </div>
        </div>
        <div className="stack">
          <h1>Klinik takip operasyonu için güvenli çalışma alanı</h1>
          <p>
            Bakım planları, günlük takipler ve klinik değerlendirme bildirimleri için
            sade ve kontrollü bir yönetim deneyimi.
          </p>
        </div>
        {changed && <p className="form-success" role="status">Parolanız güncellendi. Yeni parolanızla giriş yapabilirsiniz.</p>}
        <LoginForm />
        {demo && <div className="phase11-links">
          <a href="/sifre-unuttum">Parolamı unuttum</a>
          <a href="/kayit">Klinik demo hesabı oluştur</a>
        </div>}
      </section>
    </main>
  );
}
