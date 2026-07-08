"use client";

import { useState, useTransition } from "react";
import type { PortalDataRequest } from "@/lib/data-requests/portal-contracts";
import type { DataRequestType } from "@/lib/data-requests";

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
        <p>Bu işlem otomatik veri silme veya export işlemi değildir. Talep klinik tarafından incelenmek üzere kaydedilir.</p>
      </div>
      <label className="form-field">
        <span>Talep türü</span>
        <select value={requestType} disabled={isPending} onChange={(event) => setRequestType(event.target.value as DataRequestType)}>
          {Object.entries(requestLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="check-card">
        <span>
          <input type="checkbox" checked={confirmed} disabled={isPending} onChange={(event) => setConfirmed(event.target.checked)} /> Talebimin incelenmek üzere kliniğe iletileceğini anlıyorum.
        </span>
      </label>
      <button className="button" type="button" disabled={!confirmed || isPending} onClick={submit}>
        {isPending ? "Kaydediliyor..." : "Talep oluştur"}
      </button>
      {message ? <p className="success-message" aria-live="polite">{message}</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <div className="card-list">
        {requests.map((request) => (
          <article className="item-card" key={request.id}>
            <div>
              <strong>{requestLabels[request.requestType]}</strong>
              <p className="label">{request.status === "submitted" ? "Kaydedildi" : request.status}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
