import type { Pool } from "pg";
import type { MailProvider } from "../../lib/notifications/mailpit.mjs";

export function runNotificationTick(pool: Pool, provider: MailProvider | null, limit?: number): Promise<{
  scheduled: number; accepted: number; retry: number; failed: number; cancelled: number; deferred: number;
}>;
