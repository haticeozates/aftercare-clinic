import { redirect } from "next/navigation";
import { DraftEditor, TemplateVersionPreview } from "./draft-editor";
import { getTemplateDetail, getTemplateVersionDetail } from "@/lib/templates/service";

export const dynamic = "force-dynamic";

export default async function TemplateDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail } = await getTemplateDetail(id);

  if (!detail.draftVersionId) {
    redirect(`/clinic/templates/${id}`);
  }

  const { version, canManage } = await getTemplateVersionDetail(detail.draftVersionId);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Şablon editörü</p>
        <h1>{version.templateName}</h1>
        <p>{version.procedureName}</p>
      </div>

      {canManage ? (
        <DraftEditor version={version} />
      ) : (
        <div className="stack">
          <div className="notice">Bu şablon çalışan rolü için salt okunurdur.</div>
          <TemplateVersionPreview version={version} />
        </div>
      )}
    </section>
  );
}
