export type MailConfiguration = { mail: string; app: string };
export function notificationMailConfig(env?: Record<string, string | undefined>): MailConfiguration | null;
export function isolatedNotificationDatabase(value: string | undefined, toml: string): boolean;
