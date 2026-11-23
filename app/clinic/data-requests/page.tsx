import { DataRequestReviewCard } from "@/components/clinic/data-request-review-card";
import { EmptyState } from "@/components/ui";
import { listDataRequests } from "@/lib/data-requests/service";

export const dynamic = "force-dynamic";

export default async function DataRequestsPage() {
  const { requests, canManage, staffOptions, eventsByRequestId } = await listDataRequests();

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Veri Talepleri</p>
        <h1>Veri talebi kayıtları</h1>
        <p>Danışan veri talepleri için güvenli kayıt, personel ataması ve durum geçmişini takip edin.</p>
      </div>

      <div className="panel">
        {requests.length === 0 ? (
          <EmptyState
            title="Veri talebi bulunamadı"
            description="Bu ekran yalnız kayıt tutar; otomatik dışa aktarma veya silme başlatmaz."
          />
        ) : (
          <div className="card-list">
            {requests.map((request) => (
              <DataRequestReviewCard
                key={request.id}
                request={request}
                canManage={canManage}
                staffOptions={staffOptions}
                events={eventsByRequestId[request.id] ?? []}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
