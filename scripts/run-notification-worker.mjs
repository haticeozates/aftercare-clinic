import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { isolatedNotificationDatabase, notificationMailConfig } from "../lib/notifications/local-mail.mjs";
import { mailpit } from "../lib/notifications/mailpit.mjs";
import { runNotificationTick } from "./lib/notification-worker.mjs";

const args = process.argv.slice(2);
if (args.some((arg) => !["--once", "--watch"].includes(arg)) || args.length > 1) {
  console.error("Usage: npm run notifications:worker -- [--once|--watch]");
  process.exit(1);
}
const target = process.env.TEST_DATABASE_URL;
if (!["development","test","local"].includes(process.env.APP_ENV)
  || !isolatedNotificationDatabase(target, readFileSync("supabase/config.toml", "utf8"))) {
  console.error("Notification worker requires the isolated local test runner.");
  process.exit(1);
}
const config = notificationMailConfig();
if (process.env.PHASE13_MAIL_ENABLED === "true" && !config) {
  console.error("Invalid local notification mail configuration.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: target, max: 3, statement_timeout: 12_000 });
const provider = config ? mailpit(config) : null;
let watching = args.includes("--watch");
process.on("SIGINT", () => { watching=false; });
process.on("SIGTERM", () => { watching=false; });

try {
  do {
    const totals = await runNotificationTick(pool,provider);
    console.log(JSON.stringify(totals));
    if (watching) await delay(5000);
  } while (watching);
} catch {
  console.error("Notification worker stopped after a database error.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
