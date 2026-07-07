import Link from "next/link";
import { cloneElement, isValidElement } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes } from "react";

type Tone = "teal" | "sage" | "gold" | "rose" | "neutral";
type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "info";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function statusBadgeVariant(status: string): BadgeVariant {
  if (["active", "published", "completed"].includes(status)) {
    return "success";
  }
  if (["open", "acknowledged", "scheduled", "draft", "available"].includes(status)) {
    return "warning";
  }
  if (["stopped", "inactive", "archived", "revoked", "expired"].includes(status)) {
    return "danger";
  }
  return "neutral";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return <button className={cx("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)} {...props} />;
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return <Link className={cx("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)} href={href} {...props} />;
}

export function Badge({
  className,
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cx("badge", `badge--${variant}`, className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("panel", "surface-card", className)} {...props} />;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <article className={cx("stat-card", `stat-card--${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </article>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header row-between">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {action ? <div className="page-actions">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? <div className="button-row">{action}</div> : null}
    </div>
  );
}

export function Notice({
  title,
  children,
  variant = "info"
}: {
  title?: string;
  children: ReactNode;
  variant?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <div className={cx("notice", `notice--${variant}`)} role={variant === "danger" ? "alert" : "status"}>
      {title ? <strong>{title}</strong> : null}
      <p>{children}</p>
    </div>
  );
}

export function FormField({
  id,
  label,
  description,
  error,
  children
}: {
  id: string;
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
}) {
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const control =
    isValidElement(children) && describedBy
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
          "aria-describedby": describedBy
        })
      : children;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {description ? <p id={`${id}-description`}>{description}</p> : null}
      <div>{control}</div>
      {error ? (
        <p className="form-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("ui-input", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("ui-input", className)} {...props} />;
}
