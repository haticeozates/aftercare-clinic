export default function UnauthorizedPage() {
  return (
    <main className="shell">
      <section className="panel stack">
        <p className="eyebrow">Yetkisiz erişim</p>
        <h1>Aktif organizasyon üyeliği bulunamadı</h1>
        <p>
          Bu production temel ekranı, yalnızca doğrulanmış local/test kullanıcı ve aktif
          organization membership ile açılacak şekilde tasarlanmıştır.
        </p>
      </section>
    </main>
  );
}
