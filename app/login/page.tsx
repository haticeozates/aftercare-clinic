import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="shell">
      <section className="panel stack">
        <p className="eyebrow">AfterCare Clinic</p>
        <h1>Production temel ortamı</h1>
        <p>
          Local/test Supabase Auth oturumu ile giriş yapın. Gerçek kullanıcı,
          sağlık verisi veya production e-posta akışı bu fazda yoktur.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
