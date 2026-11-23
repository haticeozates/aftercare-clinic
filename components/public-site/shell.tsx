import Link from "next/link";
import { mainLinks } from "@/lib/public-site/content";
import { PublicHeader } from "./header";
import "./public-site.css";

const footerGroups = [
  { label: "Ürün", links: mainLinks },
  {
    label: "AfterCare Clinic",
    links: [
      ["/hakkinda", "Hakkında"],
      ["/sss", "Sıkça sorulan sorular"],
      ["/iletisim", "İletişim"],
      ["/demo", "Demo talep et"]
    ]
  },
  {
    label: "Yasal bilgiler",
    links: [
      ["/gizlilik", "Gizlilik politikası"],
      ["/kullanim-kosullari", "Kullanım koşulları"],
      ["/kvkk", "KVKK"],
      ["/cerezler", "Çerez politikası"]
    ]
  }
] as const;

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ac-site">
      <a className="ac-skip" href="#public-main">
        Ana içeriğe geç
      </a>
      <PublicHeader />
      <main id="public-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="ac-footer">
        <div className="ac-wrap">
          <div className="ac-footer-grid">
            <div>
              <Link className="ac-brand" href="/" aria-label="AfterCare Clinic ana sayfa">
                <span className="ac-mark" aria-hidden="true">
                  AC
                </span>
                <span>
                  AfterCare <strong>Clinic</strong>
                </span>
              </Link>
              <p>Klinikler ve danışanları için işlem sonrası bakım takibi.</p>
            </div>
            {footerGroups.map(({ label, links }) => (
              <nav className="ac-footer-group" aria-label={label} key={label}>
                <h2>{label}</h2>
                {links.map(([href, text]) => (
                  <Link key={href} href={href}>
                    {text}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
          <div className="ac-footer-bottom">
            <span>AfterCare Clinic · Portfolio Edition</span>
            <Link href="/login">
              Klinik girişi <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
