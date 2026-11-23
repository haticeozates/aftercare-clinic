"use client";

import { useActionState, type ReactNode } from "react";
import type { NoticeState } from "@/lib/notifications/actions";

export function NoticeForm({ action, children, submit, primary = false }: {
  action: (state: NoticeState, data: FormData) => Promise<NoticeState>;
  children: ReactNode;
  submit: string;
  primary?: boolean;
}) {
  const [state, send, busy] = useActionState(action, {});
  return (
    <form action={send} aria-busy={busy} className="notice-action-form">
      {children}
      <button className={`ui-button ui-button--${primary ? "primary" : "secondary"} ui-button--sm`} type="submit" disabled={busy}>
        {busy ? "Kaydediliyor…" : submit}
      </button>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
    </form>
  );
}
