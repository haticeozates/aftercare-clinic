import Link from "next/link";
import { InquiryForm } from "@/components/public-site/inquiry-form";
import { PublicIntro } from "@/components/public-site/sections";
import { publicInquiriesEnabled } from "@/lib/public-site/inquiry-config";
import { publicMetadata } from "@/lib/public-site/seo";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("/demo");

export default function DemoPage() {
  const formsEnabled = publicInquiriesEnabled();
  return (
    <>
      <PublicIntro label="Ürün demosu" title="AfterCare Clinic’i inceleyin.">
        Klinik paneli ve danışan portalını sentetik bir bakım planı üzerinden keşfedin.
      </PublicIntro>
      <section className="ac-wrap ac-section ac-form-grid">
        {formsEnabled && <InquiryForm kind="demo" />}
        <div>
          <h2>Demoda neler var?</h2>
          <ul className="ac-checklist">
            <li>Bakım şablonundan danışana özel plan oluşturma</li>
            <li>Danışan portalında görev ve durum bildirimi</li>
            <li>Klinik panelinde fotoğraf ve bildirim inceleme</li>
          </ul>
          {formsEnabled ? (
            <p>Form talebinizi sisteme kaydeder. Otomatik e-posta gönderimi yoktur.</p>
          ) : (
            <p><Link className="ac-text-link" href="/#urun-galerisi">Ürün ekranlarını inceleyin</Link></p>
          )}
        </div>
      </section>
    </>
  );
}
