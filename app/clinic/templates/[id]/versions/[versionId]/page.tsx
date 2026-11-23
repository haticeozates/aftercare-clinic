import { TemplateVersionPreview } from "../../draft/draft-editor";
import { templateVersionStatusLabel } from "@/lib/templates";
import { getTemplateVersionDetail } from "@/lib/templates/service";

export const dynamic = "force-dynamic";

export default async function TemplateVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const { version } = await getTemplateVersionDetail(versionId);

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Versiyon görüntüleme</p>
        <h1>{version.templateName}</h1>
        <p>{version.procedureName}</p>
        <span className="badge">{templateVersionStatusLabel(version.status)}</span>
      </div>

      <TemplateVersionPreview version={version} />
    </section>
  );
}
