"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitPublicInquiry } from "@/lib/public-site/actions";
import type { InquiryField, InquiryKind, InquiryState } from "@/lib/public-site/inquiry";

const initial: InquiryState = { status: "idle" };

export function InquiryForm({ kind }: { kind: InquiryKind }) {
  const [values, setValues] = useState({ name: "", email: "", clinic: "", message: "" });
  const [state, action, pending] = useActionState(
    async (previous: InquiryState, form: FormData) => {
      const result = await submitPublicInquiry(kind, previous, form);
      if (result.status === "success")
        setValues({ name: "", email: "", clinic: "", message: "" });
      return result;
    },
    initial
  );
  const feedback = useRef<HTMLDivElement>(null);
  const errors = state.status === "error" ? state.fields : undefined;

  useEffect(() => {
    if (state.status !== "idle") feedback.current?.focus();
  }, [state]);

  function feedbackProps(field: InquiryField) {
    return {
      "aria-invalid": errors?.[field] ? true : undefined,
      "aria-describedby": errors?.[field] ? `error-${field}` : undefined
    };
  }

  return (
    <form className="ac-form" action={action} noValidate aria-busy={pending}>
      <div className="ac-form-heading">
        <h2>{kind === "demo" ? "Demo talebi" : "İletişim formu"}</h2>
        <p>Tüm alanlar zorunludur.</p>
      </div>
      {state.status !== "idle" && (
        <div
          className={`ac-form-feedback ac-form-${state.status}`}
          ref={feedback}
          tabIndex={-1}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.status === "error"
            ? state.message
            : kind === "demo"
              ? "Demo talebiniz kaydedildi."
              : "Mesajınız kaydedildi."}
        </div>
      )}
      <div className="ac-form-field">
        <label htmlFor="inquiry-name">Ad soyad</label>
        <input
          id="inquiry-name"
          name="name"
          autoComplete="name"
          required
          readOnly={pending}
          maxLength={100}
          value={values.name}
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
          {...feedbackProps("name")}
        />
        {errors?.name && <span id="error-name">{errors.name}</span>}
      </div>
      <div className="ac-form-field">
        <label htmlFor="inquiry-email">E-posta</label>
        <input
          id="inquiry-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly={pending}
          maxLength={254}
          value={values.email}
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
          {...feedbackProps("email")}
        />
        {errors?.email && <span id="error-email">{errors.email}</span>}
      </div>
      {kind === "demo" ? (
        <div className="ac-form-field">
          <label htmlFor="inquiry-clinic">Klinik veya kurum</label>
          <input
            id="inquiry-clinic"
            name="clinic"
            autoComplete="organization"
            required
            readOnly={pending}
            maxLength={140}
            value={values.clinic}
            onChange={(event) =>
              setValues((current) => ({ ...current, clinic: event.target.value }))
            }
            {...feedbackProps("clinic")}
          />
          {errors?.clinic && <span id="error-clinic">{errors.clinic}</span>}
        </div>
      ) : (
        <div className="ac-form-field">
          <label htmlFor="inquiry-message">Mesajınız</label>
          <textarea
            id="inquiry-message"
            name="message"
            required
            readOnly={pending}
            maxLength={1000}
            rows={5}
            value={values.message}
            onChange={(event) =>
              setValues((current) => ({ ...current, message: event.target.value }))
            }
            {...feedbackProps("message")}
          />
          {errors?.message && <span id="error-message">{errors.message}</span>}
        </div>
      )}
      <div className="ac-trap" aria-hidden="true">
        <label htmlFor="inquiry-website">Web sitesi</label>
        <input id="inquiry-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="ac-form-note">
        Hasta bilgisi veya sağlık verisi paylaşmayın. Form verileri hakkında{" "}
        <Link href="/gizlilik">gizlilik taslağını</Link> inceleyebilirsiniz.
      </p>
      <button className="ac-button ac-button-primary" type="submit" disabled={pending}>
        {pending
          ? "Kaydediliyor…"
          : kind === "demo"
            ? "Demo talebini kaydet"
            : "Mesajı kaydet"}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
