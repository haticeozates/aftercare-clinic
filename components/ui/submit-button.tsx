"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      className={cx("button", variant === "secondary" ? "secondary" : null, className)}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
