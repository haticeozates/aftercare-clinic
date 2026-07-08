import { transitionDataRequestAction } from "@/lib/data-requests/actions";
import {
  dataRequestStatusLabel,
  dataRequestTypeLabel,
  listDataRequests,
  nextDataRequestStatuses
} from "@/lib/data-requests/service";
import { formatDisplayDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function DataRequestsPage() {
  const { requests, canManage } = await listDataRequests();

  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Veri Talepleri</p>
        <h1>Veri talebi kayıtları</h1>
        <p>Danışan veri talepleri için güvenli workflow kaydını ve durum geçmişini takip edin.</p>
      </div>

      <div className="panel">
        {requests.length === 0 ? (
          <div className="empty-state">
            <h2>Veri talebi bulunamadı</h2>
            <p>Bu ekran yalnız workflow kaydı tutar; otomatik dışa aktarma veya silme başlatmaz.</p>
          </div>
        ) : (
          <div className="card-list">
            {requests.map((request) => {
              const nextStatuses = nextDataRequestStatuses(request.status);
              return (
                <article className="item-card" key={request.id}>
                  <div>
                    <h2>{dataRequestTypeLabel(request.requestType)}</h2>
                    <p>
                      {request.clientName} · {formatDisplayDateTime(request.submittedAt)}
                    </p>
                    <span className="badge">{dataRequestStatusLabel(request.status)}</span>
                    {request.resolutionCode ? <span className="badge">{request.resolutionCode}</span> : null}
                  </div>
                  {canManage && nextStatuses.length > 0 ? (
                    <form action={transitionDataRequestAction} data-request-id={request.id} className="toolbar">
                      <input type="hidden" name="dataRequestId" value={request.id} />
                      <label>
                        Yeni durum
                        <select name="status" defaultValue={nextStatuses[0]}>
                          {nextStatuses.map((status) => (
                            <option key={status} value={status}>
                              {dataRequestStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <input type="hidden" name="resolutionCode" value="manual_review_completed" />
                      <button className="button secondary" type="submit">
                        Durumu güncelle
                      </button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
