export default function LoginPage() {
  return (
    <main className="shell">
      <section className="panel stack">
        <p className="eyebrow">AfterCare Clinic</p>
        <h1>Production temel ortamı</h1>
        <p>
          Bu ekran yalnızca local/test auth temelini doğrulamak içindir. Gerçek kullanıcı,
          danışan, sağlık verisi veya production e-posta akışı bu fazda yoktur.
        </p>
        <a className="button" href="/clinic">
          Klinik alanına geç
        </a>
      </section>
    </main>
  );
}
