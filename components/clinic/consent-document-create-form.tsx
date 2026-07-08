"use client";

import { useActionState } from "react";
import { createConsentDocumentFormAction, type ConsentActionState } from "@/lib/consent/actions";

const initialState: ConsentActionState = {};

export function ConsentDocumentCreateForm() {
  const [state, action, pending] = useActionState(createConsentDocumentFormAction, initialState);

  return (
    <form className="panel stack" action={action}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Yeni Taslak</p>
          <h2>Belge taslağı oluştur</h2>
        </div>
      </div>
      <div className="form-grid">
        <label>
          Belge kodu
          <input name="code" placeholder="local-notice" required />
        </label>
        <label>
          Başlık
          <input name="title" placeholder="Temsili bilgilendirme belgesi" required />
        </label>
        <label>
          Belge türü
          <select name="documentKind" defaultValue="notice">
            <option value="notice">Bilgilendirme</option>
            <option value="consent">Onay</option>
          </select>
        </label>
        <label>
          Amaç anahtarı
          <input name="purposeKey" placeholder="local_notice" required />
        </label>
      </div>
      <label>
        Versiyon başlığı
        <input name="titleSnapshot" placeholder="Temsili bilgilendirme v1" required />
      </label>
      <label>
        Özet
        <textarea name="summaryText" rows={2} placeholder="Bu belge gerçek bir hukuki metin değildir." />
      </label>
      <label>
        Belge metni
        <textarea
          name="bodyText"
          rows={5}
          placeholder="Temsili bilgilendirme metni — yalnızca yerel test kullanımı içindir."
          required
        />
      </label>
      {state.error ? (
        <p className="form-error" role="alert" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Oluşturuluyor..." : "Taslak oluştur"}
      </button>
    </form>
  );
}
