import type { PortalDocumentAssignment } from "@/lib/consent/portal-contracts";
import { PortalDocumentCard } from "@/components/care/portal-document-card";

export function PortalDocumentsSection({ assignments }: { assignments: PortalDocumentAssignment[] }) {
  if (assignments.length === 0) {
    return null;
  }

  return (
    <section className="care-section stack" aria-labelledby="portal-documents-heading">
      <div>
        <p className="eyebrow">Belgeler</p>
        <h2 id="portal-documents-heading">Belgeler ve tercihlerim</h2>
      </div>
      <div className="card-list">
        {assignments.map((assignment) => (
          <PortalDocumentCard assignment={assignment} key={assignment.assignmentId} />
        ))}
      </div>
    </section>
  );
}
