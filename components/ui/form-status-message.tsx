import { FeedbackMessage } from "@/components/ui/feedback-message";

export function FormStatusMessage({
  success,
  error
}: {
  success?: string;
  error?: string;
}) {
  return (
    <>
      {success ? <FeedbackMessage tone="success">{success}</FeedbackMessage> : null}
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
    </>
  );
}
