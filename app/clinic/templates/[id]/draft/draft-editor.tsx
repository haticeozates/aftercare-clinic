"use client";

import { useActionState } from "react";
import {
  addAlertRuleAction,
  addDayAction,
  addSymptomOptionAction,
  addTaskAction,
  publishDraftFormAction
} from "@/lib/templates/actions";
import type { TemplateVersionDetail } from "@/lib/templates/service";

function ErrorLine({ error }: { error?: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}

export function DraftEditor({ version }: { version: TemplateVersionDetail }) {
  const [dayState, addDay, dayPending] = useActionState(addDayAction, {});
  const [taskState, addTask, taskPending] = useActionState(addTaskAction, {});
  const [symptomState, addSymptom, symptomPending] = useActionState(addSymptomOptionAction, {});
  const [ruleState, addRule, rulePending] = useActionState(addAlertRuleAction, {});
  const [publishState, publish, publishPending] = useActionState(publishDraftFormAction, {});

  return (
    <div className="stack">
      <div className="panel stack">
        <h2>v{version.versionNumber} düzenleme</h2>
        <span className="badge">Taslak</span>

        <form className="form-grid" action={addDay}>
          <input type="hidden" name="versionId" value={version.id} />
          <label htmlFor="day-title">Gün başlığı</label>
          <input id="day-title" name="title" maxLength={120} placeholder="Temsili takip günü" />
          <ErrorLine error={dayState.error} />
          <button className="button secondary" type="submit" disabled={dayPending}>
            Gün ekle
          </button>
        </form>

        <form className="form-grid" action={addTask}>
          <input type="hidden" name="versionId" value={version.id} />
          <label htmlFor="task-title">Görev başlığı</label>
          <input
            id="task-title"
            name="title"
            required
            maxLength={180}
            placeholder="Klinik tarafından yapılandırılmış temsili günlük görev"
          />
          <label htmlFor="task-type">Görev türü</label>
          <select id="task-type" name="taskType" defaultValue="do">
            <option value="do">Yapılacak</option>
            <option value="avoid">Kaçınılacak</option>
            <option value="check">Kontrol</option>
            <option value="information">Bilgilendirme</option>
          </select>
          <input type="hidden" name="required" value="true" />
          <ErrorLine error={taskState.error} />
          <button className="button secondary" type="submit" disabled={taskPending}>
            Görev ekle
          </button>
        </form>

        <form className="form-grid" action={addSymptom}>
          <input type="hidden" name="versionId" value={version.id} />
          <label htmlFor="symptom-label">Belirti seçeneği</label>
          <input
            id="symptom-label"
            name="label"
            required
            maxLength={160}
            placeholder="Klinik değerlendirmesi için temsili durum"
          />
          <ErrorLine error={symptomState.error} />
          <button className="button secondary" type="submit" disabled={symptomPending}>
            Belirti ekle
          </button>
        </form>

        <form className="form-grid" action={addRule}>
          <input type="hidden" name="versionId" value={version.id} />
          <label htmlFor="rule-message">Kural mesajı</label>
          <input id="rule-message" name="messageLabel" required maxLength={180} placeholder="Temsili takip uyarısı" />
          <label htmlFor="rule-type">Kural türü</label>
          <select id="rule-type" name="ruleType" defaultValue="symptom_selected">
            <option value="symptom_selected">Belirti seçildi</option>
            <option value="severity_threshold">Şiddet eşiği</option>
            <option value="task_incomplete">Görev eksik</option>
            <option value="photo_missing">Fotoğraf bekleniyor</option>
          </select>
          <label htmlFor="severity-level">Önem seviyesi</label>
          <select id="severity-level" name="severityLevel" defaultValue="medium">
            <option value="low">Düşük</option>
            <option value="medium">Orta</option>
            <option value="high">Yüksek</option>
          </select>
          <ErrorLine error={ruleState.error} />
          <button className="button secondary" type="submit" disabled={rulePending}>
            Kural ekle
          </button>
        </form>

        <form action={publish}>
          <input type="hidden" name="versionId" value={version.id} />
          <input type="hidden" name="templateId" value={version.templateId} />
          <ErrorLine error={publishState.error} />
          <button className="button" type="submit" disabled={publishPending}>
            Yayına al
          </button>
        </form>
      </div>

      <TemplateVersionPreview version={version} />
    </div>
  );
}

export function TemplateVersionPreview({ version }: { version: TemplateVersionDetail }) {
  return (
    <div className="panel stack">
      <h2>Önizleme</h2>
      <div className="card-list">
        {version.days.length === 0 ? (
          <div className="empty-state">
            <h3>Henüz gün eklenmedi</h3>
            <p>Yayına almak için en az bir gün ve bir görev gerekir.</p>
          </div>
        ) : (
          version.days.map((day) => (
            <article className="item-card" key={day.id}>
              <div>
                <h3>{day.title ?? `Gün ${day.dayNumber}`}</h3>
                {day.tasks.length === 0 ? (
                  <p>Bu güne henüz görev eklenmedi.</p>
                ) : (
                  <ul>
                    {day.tasks.map((task) => (
                      <li key={task.id}>{task.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <h3>Belirti seçenekleri</h3>
      <div className="toolbar">
        {version.symptomOptions.length === 0 ? (
          <span className="badge">Henüz seçenek yok</span>
        ) : (
          version.symptomOptions.map((option) => (
            <span className="badge" key={option.id}>
              {option.label}
            </span>
          ))
        )}
      </div>

      <h3>Takip kuralları</h3>
      <div className="toolbar">
        {version.alertRules.length === 0 ? (
          <span className="badge">Henüz kural yok</span>
        ) : (
          version.alertRules.map((rule) => (
            <span className="badge" key={rule.id}>
              {rule.messageLabel}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
