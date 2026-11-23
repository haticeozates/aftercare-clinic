import Link from "next/link";
import { InquiryForm } from "@/components/public-site/inquiry-form";
import { PublicIntro } from "@/components/public-site/sections";
import { publicInquiriesEnabled } from "@/lib/public-site/inquiry-config";
import { publicMetadata } from "@/lib/public-site/seo";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("/iletisim");

export default function ContactPage() {
  const formsEnabled = publicInquiriesEnabled();
  return (
    <>
      <PublicIntro label="İletişim" title="Sorunuz veya geri bildiriminiz mi var?">
        {formsEnabled ? "AfterCare Clinic hakkında bir mesaj bırakabilirsiniz." : "AfterCare Clinic hakkında merak ettiklerinizi keşfedin."}
      </PublicIntro>
      <section className="ac-wrap ac-section ac-form-grid">
        {formsEnabled && <InquiryForm kind="contact" />}
        <div>
          <h2>{formsEnabled ? "AfterCare Clinic’e yazın" : "Portföy sürümü hakkında"}</h2>
          <p>
            {formsEnabled ? "Form mesajınızı sisteme kaydeder." : "Bu portföy sürümünde iletişim formu kapalıdır."}{" "}
            Sağlık ve bakım sorularınız için kendi kliniğinizin iletişim kanalını kullanın.
          </p>
          <Link className="ac-text-link" href="/sss">
            Sıkça sorulan sorular <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </>
  );
}
