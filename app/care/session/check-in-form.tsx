"use client";

import { useMemo, useState, useTransition } from "react";
import type { PortalCheckInOption } from "@/lib/portal";

const severityLabels = [
  ["1", "Çok hafif"],
  ["2", "Hafif"],
  ["3", "Orta"],
  ["4", "Belirgin"],
  ["5", "Çok belirgin"]
] as const;

export function CheckInForm({
  dayId,
  mode,
  availability,
  options,
  alreadySubmitted
}: {
  dayId: string;
  mode: "scheduled" | "active" | "readonly";
  availability: "available" | "locked" | "readonly";
  options: PortalCheckInOption[];
  alreadySubmitted: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [severity, setSeverity] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(alreadySubmitted ? "Bugün için bildiriminiz kaydedildi." : "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const disabled = alreadySubmitted || mode !== "active" || availability !== "available" || isPending;

  const selectedSeverityRequired = useMemo(
    () => options.some((option) => option.allowsSeverity && selected[option.id] && !severity[option.id]),
    [options, selected, severity]
  );

  async function submit() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/care/session/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dayId,
          items: options.map((option) => ({
            optionId: option.id,
            selected: selected[option.id] === true,
            severity: option.allowsSeverity && selected[option.id] ? Number(severity[option.id]) : null
          }))
        })
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(result.error ?? "Bildiriminiz kaydedilemedi. Lütfen sayfayı yenileyin.");
        return;
      }
      setMessage(result.message ?? "Bildiriminiz kliniğinizin değerlendirmesi için kaydedildi.");
    });
  }

  if (options.length === 0 || mode !== "active" || availability !== "available") {
    return null;
  }

  return (
    <section className="care-section stack" aria-labelledby="check-in-heading">
      <div>
        <p className="eyebrow">Günlük durum</p>
        <h2 id="check-in-heading">Bugünkü durumunuzu kliniğinizle paylaşın</h2>
        <p>Bu ekran tıbbi değerlendirme veya teşhis sunmaz.</p>
      </div>

      <div className="stack">
        {options.map((option) => (
          <label className="check-card" key={option.id}>
            <span>
              <input
                type="checkbox"
                checked={selected[option.id] === true}
                disabled={disabled}
                onChange={(event) => {
                  setSelected((current) => ({ ...current, [option.id]: event.target.checked }));
                }}
              />{" "}
              {option.label}
            </span>
            {option.allowsSeverity && selected[option.id] ? (
              <select
                aria-label={`${option.label} şiddet seçimi`}
                value={severity[option.id] ?? ""}
                disabled={disabled}
                onChange={(event) => setSeverity((current) => ({ ...current, [option.id]: event.target.value }))}
              >
                <option value="">Şiddet seçin</option>
                {severityLabels.map(([value, label]) => (
                  <option value={value} key={value}>
                    {value} {label}
                  </option>
                ))}
              </select>
            ) : null}
          </label>
        ))}
      </div>

      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="error-message">{error}</p> : null}
      <button className="button" type="button" disabled={disabled || selectedSeverityRequired} onClick={submit}>
        {isPending ? "Kaydediliyor..." : alreadySubmitted ? "Kaydedildi" : "Kliniğe gönder"}
      </button>
    </section>
  );
}
