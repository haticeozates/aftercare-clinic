export default function UnauthorizedPage() {
  return (
    <main className="shell">
      <section className="panel stack">
        <p className="eyebrow">Yetkisiz erişim</p>
        <h1>Aktif organizasyon üyeliği bulunamadı</h1>
        <p>
          Bu ekran yalnızca doğrulanmış hesap ve aktif organizasyon üyeliği ile açılır. Yerel test ortamında
          doğru kullanıcıyla giriş yaptığınızdan emin olun.
        </p>
      </section>
    </main>
  );
}
