import type { MailConfiguration } from "./local-mail.mjs";

type MailKind = "appointment_confirmed" | "appointment_rescheduled" | "appointment_cancelled" | "appointment_reminder" | "follow_up_reminder";
export type MailProvider = {
  deliver(job: { id: string; to: string; kind: MailKind }): Promise<{
    result: "reconciled" | "accepted" | "provider_rejected" | "provider_unavailable"; id?: string;
  }>;
};
export const syntheticEmail: RegExp;
export function mailpit(config: MailConfiguration): MailProvider;
