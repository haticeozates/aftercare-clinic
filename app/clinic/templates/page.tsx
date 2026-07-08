import Link from "next/link";
import { type TemplateStatus } from "@/lib/templates";
import { listActiveProcedureOptions, listTemplates } from "@/lib/templates/service";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ status?: TemplateStatus; procedureId?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "inactive" ? "inactive" : "active";
  const [{ templates, canManage }, procedures] = await Promise.all([
    listTemplates({ status, procedureId: params.procedureId || undefined }),
    listActiveProcedureOptions()
  ]);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Bakım Şablonları</p>
        <h1>Bakım şablonları</h1>
        <p>Yayınlanmış bakım şablonlarını görüntüleyin, taslakları kontrollü şekilde hazırlayın.</p>
        {canManage ? (
          <Link className="button" href="/clinic/templates/new">
            Yeni şablon
          </Link>
        ) : null}
      </div>

      <form className="toolbar" action="/clinic/templates">
        <select name="status" defaultValue={status}>
          <option value="active">Aktif</option>
          <option value="inactive">Pasif</option>
        </select>
        <select name="procedureId" defaultValue={params.procedureId ?? ""}>
          <option value="">Tüm işlemler</option>
          {procedures.map((procedure) => (
            <option key={procedure.id} value={procedure.id}>
              {procedure.name}
            </option>
          ))}
        </select>
        <button className="button secondary" type="submit">
          Filtrele
        </button>
      </form>

      <div className="panel">
        {templates.length === 0 ? (
          <div className="empty-state">
            <h2>Şablon bulunamadı</h2>
            <p>Filtreyi değiştirin veya yetkiniz varsa yeni taslak şablon oluşturun.</p>
          </div>
        ) : (
          <div className="card-list">
            {templates.map((template) => (
              <article className="item-card" key={template.id}>
                <div>
                  <h2>
                    <Link className="subtle-link" href={`/clinic/templates/${template.id}`}>
                      {template.name}
                    </Link>
                  </h2>
                  <p>{template.procedureName}</p>
                  <span className="badge">{template.status === "active" ? "Aktif" : "Pasif"}</span>
                  <span className="badge">
                    {template.currentVersionNumber ? `Yayın v${template.currentVersionNumber}` : "Yayın yok"}
                  </span>
                  <span className="badge">{template.draftVersionId ? "Taslak var" : "Taslak yok"}</span>
                </div>
                <Link className="button secondary" href={`/clinic/templates/${template.id}`}>
                  Detay
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
