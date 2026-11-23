import type { HTMLAttributes } from "react";
import type { FeedbackTone } from "@/lib/ui/feedback-contracts";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FeedbackMessage({
  tone,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & {
  tone: FeedbackTone;
  children: string;
}) {
  const role = tone === "error" ? "alert" : "status";
  const ariaLive = tone === "error" ? "assertive" : "polite";
  const toneClass =
    tone === "error" ? "form-error" : tone === "success" ? "form-success" : tone === "warning" ? "notice notice--warning" : "notice";

  return (
    <p className={cx(toneClass, className)} role={role} aria-live={ariaLive} {...props}>
      {children}
    </p>
  );
}
