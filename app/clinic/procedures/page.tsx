import { createProcedureAction, deactivateProcedureAction } from "@/lib/procedures/actions";
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
        <p>Bu fazda yalnız işlem adı ve kısa işletme açıklaması tutulur; bakım talimatı yoktur.</p>
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
        <form className="panel form-grid" action={createProcedureAction}>
          <h2>Yeni işlem</h2>
          <label>
            İşlem adı
            <input name="name" required minLength={2} maxLength={120} />
          </label>
          <label>
            Kategori
            <input name="category" maxLength={80} placeholder="Temsili kategori" />
          </label>
          <label>
            Kısa açıklama
            <textarea
              name="description"
              maxLength={280}
              placeholder="Klinik tarafından yapılandırılacak temsili işlem kaydı"
            />
          </label>
          <button className="button" type="submit">
            İşlem oluştur
          </button>
        </form>
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
          <div className="card-list">
            {procedures.map((procedure) => (
              <article className="item-card" key={procedure.id}>
                <div>
                  <h2>{procedure.name}</h2>
                  <p>{procedure.description ?? "Klinik tarafından yapılandırılacak temsili işlem kaydı"}</p>
                  <span className="badge">{procedure.category ?? "Kategori yok"}</span>
                  <span className="badge">{procedure.status === "active" ? "Aktif" : "Pasif"}</span>
                </div>
                {canManage && procedure.status === "active" ? (
                  <form action={deactivateProcedureAction}>
                    <input type="hidden" name="id" value={procedure.id} />
                    <button className="button secondary" type="submit">
                      Pasifleştir
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
