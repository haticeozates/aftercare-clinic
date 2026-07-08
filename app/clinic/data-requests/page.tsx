import { DataRequestReviewCard } from "@/components/clinic/data-request-review-card";
import { listDataRequests } from "@/lib/data-requests/service";

export const dynamic = "force-dynamic";

export default async function DataRequestsPage() {
  const { requests, canManage, staffOptions, eventsByRequestId } = await listDataRequests();

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Veri Talepleri</p>
        <h1>Veri talebi kayıtları</h1>
        <p>Danışan veri talepleri için güvenli workflow kaydını, personel atamasını ve durum geçmişini takip edin.</p>
      </div>

      <div className="panel">
        {requests.length === 0 ? (
          <div className="empty-state">
            <h2>Veri talebi bulunamadı</h2>
            <p>Bu ekran yalnız workflow kaydı tutar; otomatik dışa aktarma veya silme başlatmaz.</p>
          </div>
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
