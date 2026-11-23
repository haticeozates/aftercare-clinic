export type FeedbackTone = "success" | "error" | "warning" | "info";

const TECHNICAL_FEEDBACK_PATTERN =
  /postgres|supabase|violates|constraint|uuid|P0001|42501|organization_id|token_hash|care_plan_task|sql error|relation /i;

export function isSafeUserFeedbackMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 240) {
    return false;
  }
  return !TECHNICAL_FEEDBACK_PATTERN.test(trimmed);
}

export function toSafeUserFeedbackMessage(message: string | undefined | null, fallback: string): string {
  if (!message) {
    return fallback;
  }
  return isSafeUserFeedbackMessage(message) ? message.trim() : fallback;
}
