"use client";

import { useState, useTransition } from "react";
import type { DataRequestStatus } from "@/lib/data-requests";
import { dataRequestStatusLabel } from "@/lib/data-requests/labels";
import type { PortalDataRequest } from "@/lib/data-requests/portal-contracts";
import type { DataRequestType } from "@/lib/data-requests";
import { FeedbackMessage } from "@/components/ui";

const requestLabels: Record<DataRequestType, string> = {
  access: "Erişim talebi",
  copy: "Kopya talebi",
  correction: "Düzeltme talebi",
  deletion: "Silme talebi",
  restriction: "Kısıtlama talebi",
  objection: "İtiraz talebi",
  withdraw_consent: "Onay geri çekme talebi",
  other: "Diğer talep"
};

function portalDataRequestStatusLabel(status: DataRequestStatus) {
  return dataRequestStatusLabel(status);
}

export function PortalDataRequestForm({ initialRequests }: { initialRequests: PortalDataRequest[] }) {
  const [requestType, setRequestType] = useState<DataRequestType>("access");
  const [confirmed, setConfirmed] = useState(false);
  const [requests, setRequests] = useState(initialRequests);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit() {
    if (!confirmed || isPending) {
      return;
    }
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/care/session/data-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestType, confirmed })
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok || result?.error) {
        setError(result?.error ?? "Talebiniz oluşturulamadı. Lütfen tekrar deneyin.");
        return;
      }
      const listResponse = await fetch("/care/session/data-requests");
      const list = (await listResponse.json().catch(() => null)) as { requests?: PortalDataRequest[] } | null;
      setRequests(list?.requests ?? requests);
      setMessage("Talebiniz incelenmek üzere kaydedildi.");
      setConfirmed(false);
    });
  }

  return (
    <section className="care-section stack" aria-labelledby="portal-data-request-heading">
      <div>
        <p className="eyebrow">Veri talepleri</p>
        <h2 id="portal-data-request-heading">Verilerimle ilgili talep oluştur</h2>
        <p>
          Bu işlem otomatik veri silme veya dışa aktarma işlemi değildir. Talep klinik tarafından incelenmek üzere
          kaydedilir.
        </p>
      </div>
      <label className="form-field" htmlFor="portal-data-request-type">
        <span>Talep türü</span>
        <select
          id="portal-data-request-type"
          value={requestType}
          disabled={isPending}
          onChange={(event) => setRequestType(event.target.value as DataRequestType)}
        >
          {Object.entries(requestLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="check-card" htmlFor="portal-data-request-confirm">
        <span>
          <input
            id="portal-data-request-confirm"
            type="checkbox"
            checked={confirmed}
            disabled={isPending}
            onChange={(event) => setConfirmed(event.target.checked)}
          />{" "}
          Talebimin incelenmek üzere kliniğe iletileceğini anlıyorum.
        </span>
      </label>
      <button className="button" type="button" disabled={!confirmed || isPending} onClick={submit} aria-busy={isPending}>
        {isPending ? "Kaydediliyor..." : "Talep oluştur"}
      </button>
      {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
      <div className="card-list">
        {requests.map((request) => (
          <article className="item-card" key={request.id}>
            <div>
              <strong>{requestLabels[request.requestType]}</strong>
              <p className="label">{portalDataRequestStatusLabel(request.status)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
