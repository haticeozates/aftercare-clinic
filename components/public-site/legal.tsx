import Link from "next/link";
import { PublicIntro } from "./sections";

export function LegalPage({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicIntro label="Portföy Sürümü · Taslak" title={title}>
        Bu taslak hukuki inceleme bekliyor.
      </PublicIntro>
      <article className="ac-wrap ac-section ac-readable ac-legal">
        {children}
        <Link href="/iletisim" className="ac-text-link">
          İletişim sayfası <span aria-hidden="true">↗</span>
        </Link>
      </article>
    </>
  );
}
