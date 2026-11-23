import Link from "next/link";
import type { ReactNode } from "react";
import "./phase11.css";

export function AccountCard({
  title, description, children, wide = false
}: { title: string; description: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className="login-shell phase11-shell">
      <section className={`login-card${wide ? " phase11-wide" : ""}`}>
        <Link className="brand-block phase11-brand" href="/">
          <span className="brand-mark" aria-hidden="true">AC</span>
          <span><strong>AfterCare Clinic</strong><small>Portfolio Edition</small></span>
        </Link>
        <div className="stack phase11-heading">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
