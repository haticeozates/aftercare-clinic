import Link from "next/link";
import { createDraftFromPublishedAction } from "@/lib/templates/actions";
import { getTemplateDetail } from "@/lib/templates/service";

export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, canManage } = await getTemplateDetail(id);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Şablon detayı</p>
        <h1>{detail.name}</h1>
        <p>{detail.procedureName}</p>
      </div>

      <div className="panel stack">
        <div className="toolbar">
          <span className="badge">{detail.status === "active" ? "Aktif" : "Pasif"}</span>
          <span className="badge">
            {detail.currentVersionNumber ? `Yayın v${detail.currentVersionNumber}` : "Yayınlanmış versiyon yok"}
          </span>
          <span className="badge">{detail.draftVersionId ? "Taslak" : "Taslak yok"}</span>
        </div>

        <div className="toolbar">
          {detail.draftVersionId ? (
            <Link className="button secondary" href={`/clinic/templates/${detail.id}/draft`}>
              Taslağı aç
            </Link>
          ) : null}
          {detail.currentPublishedVersionId ? (
            <Link className="button secondary" href={`/clinic/templates/${detail.id}/versions/${detail.currentPublishedVersionId}`}>
              Yayınlanan versiyonu görüntüle
            </Link>
          ) : null}
          {canManage && !detail.draftVersionId && detail.currentPublishedVersionId ? (
            <form action={createDraftFromPublishedAction}>
              <input type="hidden" name="templateId" value={detail.id} />
              <button className="button" type="submit">
                Yeni taslak oluştur
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <h2>Versiyon geçmişi</h2>
        <div className="card-list">
          {detail.versions.map((version) => (
            <article className="item-card" key={version.id}>
              <div>
                <h3>v{version.versionNumber}</h3>
                <span className="badge">
                  {version.status === "published" ? "Yayınlandı" : version.status === "draft" ? "Taslak" : "Retired"}
                </span>
              </div>
              <Link
                className="button secondary"
                href={
                  version.status === "draft"
                    ? `/clinic/templates/${detail.id}/draft`
                    : `/clinic/templates/${detail.id}/versions/${version.id}`
                }
              >
                Aç
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
