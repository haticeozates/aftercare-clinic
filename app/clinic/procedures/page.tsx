import { createProcedureAction, deactivateProcedureAction, updateProcedureAction } from "@/lib/procedures/actions";
import { listProcedures, type ProcedureStatus } from "@/lib/procedures/service";

export const dynamic = "force-dynamic";

export default async function ProceduresPage({
  searchParams
}: {
  searchParams: Promise<{ status?: ProcedureStatus }>;
}) {
  const params = await searchParams;
  const status = params.status === "inactive" ? "inactive" : "active";
  const { procedures, canManage } = await listProcedures(status);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">İşlemler</p>
        <h1>İşlem türleri</h1>
        <p>Kliniğinizde uygulanan işlem türlerini oluşturun ve yönetin.</p>
      </div>

      <form className="toolbar" action="/clinic/procedures">
        <select name="status" defaultValue={status}>
          <option value="active">Aktif</option>
          <option value="inactive">Pasif</option>
        </select>
        <button className="button secondary" type="submit">
          Filtrele
        </button>
      </form>

      {canManage ? (
        <div className="panel stack">
          <div>
            <h2>Yeni işlem</h2>
            <p>İşlem adını ve ekip içinde anlaşılır kısa tanımını ekleyin.</p>
          </div>
          <form className="procedure-create-grid" action={createProcedureAction}>
            <label>
              İşlem adı
              <input name="name" required minLength={2} maxLength={120} />
            </label>
            <label>
              Kategori
              <input name="category" maxLength={80} placeholder="Örn. Cilt bakımı" />
            </label>
            <label className="procedure-description-field">
              Kısa açıklama
              <textarea
                name="description"
                maxLength={280}
                placeholder="Kliniğinizin kendi kullanımına yönelik kısa işlem açıklaması"
              />
            </label>
            <button className="button" type="submit">
              İşlem oluştur
            </button>
          </form>
        </div>
      ) : (
        <div className="notice">Çalışan rolü işlem listesini görüntüleyebilir; işlem oluşturamaz veya düzenleyemez.</div>
      )}

      <div className="panel">
        {procedures.length === 0 ? (
          <div className="empty-state">
            <h2>İşlem bulunamadı</h2>
            <p>Filtreyi değiştirin veya yetkiniz varsa yeni işlem oluşturun.</p>
          </div>
        ) : (
          <div className="record-list">
            {procedures.map((procedure) => (
              <article className="record-row" key={procedure.id}>
                <div className="record-main">
                  <div>
                    <h2>{procedure.name}</h2>
                    <p>{procedure.description ?? "Kısa açıklama eklenmedi."}</p>
                  </div>
                  <div className="badge-row">
                    <span className="badge">{procedure.category ?? "Kategori yok"}</span>
                    <span className="badge">{procedure.status === "active" ? "Aktif" : "Pasif"}</span>
                  </div>
                </div>
                {canManage && procedure.status === "active" ? (
                  <details className="procedure-edit">
                    <summary className="button secondary">Düzenle</summary>
                    <form className="inline-form" action={updateProcedureAction}>
                      <input type="hidden" name="id" value={procedure.id} />
                      <label htmlFor={`name-${procedure.id}`}>İşlem adı</label>
                      <input id={`name-${procedure.id}`} name="name" defaultValue={procedure.name} />
                      <label htmlFor={`category-${procedure.id}`}>Kategori</label>
                      <input id={`category-${procedure.id}`} name="category" defaultValue={procedure.category ?? ""} />
                      <label htmlFor={`description-${procedure.id}`}>Kısa açıklama</label>
                      <textarea id={`description-${procedure.id}`} name="description" defaultValue={procedure.description ?? ""} />
                      <button className="button" type="submit">
                        Kaydet
                      </button>
                    </form>
                    <form action={deactivateProcedureAction}>
                      <input type="hidden" name="id" value={procedure.id} />
                      <button className="button secondary" type="submit">
                        Pasifleştir
                      </button>
                    </form>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
