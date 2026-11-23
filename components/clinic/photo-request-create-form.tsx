"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPhotoRequestAction } from "@/lib/photos/clinic-request-actions";
import { EmptyState, FeedbackMessage, SubmitButton } from "@/components/ui";

type DayOption = {
  id: string;
  dayNumber: number;
  title: string | null;
  scheduledDate: string;
  hasActiveRequest: boolean;
};

export function PhotoRequestCreateForm({
  planId,
  days,
  canCreate
}: {
  planId: string;
  days: DayOption[];
  canCreate: boolean;
}) {
  const [state, action, pending] = useActionState(createPhotoRequestAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const availableDays = days.filter((day) => !day.hasActiveRequest);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  if (!canCreate) {
    return null;
  }

  return (
    <div className="panel stack">
      <h2>Fotoğraf talebi oluştur</h2>
      <p className="muted">
        Danışanın portalda yükleyebileceği temsili bir fotoğraf talebi oluşturun. Tıbbi yorum veya teşhis
        metni eklemeyin.
      </p>

      {state.success ? (
        <FeedbackMessage tone="success">Fotoğraf talebi oluşturuldu.</FeedbackMessage>
      ) : null}
      {state.error ? <FeedbackMessage tone="error">{state.error}</FeedbackMessage> : null}

      {availableDays.length === 0 ? (
        <EmptyState
          title="Aktif fotoğraf talebi mevcut"
          description="Tüm plan günlerinde aktif fotoğraf talebi bulunuyor. Yeni talep için mevcut talebi tamamlayın veya iptal edin."
        />
      ) : (
        <form ref={formRef} action={action} className="stack">
          <input type="hidden" name="carePlanId" value={planId} />
          <label className="stack compact-stack" htmlFor="carePlanDayId">
            <span>Plan günü</span>
            <select id="carePlanDayId" name="carePlanDayId" required defaultValue="" disabled={pending}>
              <option value="" disabled>
                Gün seçin
              </option>
              {availableDays.map((day) => (
                <option key={day.id} value={day.id}>
                  Gün {day.dayNumber}
                  {day.title ? ` · ${day.title}` : ""} · {day.scheduledDate}
                </option>
              ))}
            </select>
          </label>

          <label className="stack compact-stack" htmlFor="photo-request-label">
            <span>Talep açıklaması</span>
            <input
              id="photo-request-label"
              name="label"
              required
              minLength={2}
              maxLength={120}
              placeholder="Temsili fotoğraf talebi"
              autoComplete="off"
              disabled={pending}
            />
          </label>

          <label className="checkbox-row">
            <input name="required" type="checkbox" disabled={pending} />
            Zorunlu talep
          </label>

          <SubmitButton pendingLabel="Oluşturuluyor...">Talep oluştur</SubmitButton>
        </form>
      )}
    </div>
  );
}
