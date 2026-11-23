import Link from "next/link";
import { PublicIntro, FaqList } from "@/components/public-site/sections";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/sss");

export default function Page() {
  return (
    <>
      <PublicIntro label="Yardım" title="Sıkça sorulan sorular.">
        Danışan erişimi, klinik paneli ve Portföy Sürümü hakkında kısa yanıtlar.
      </PublicIntro>
      <section className="ac-wrap ac-section ac-readable">
        <FaqList />
        <p className="ac-more">
          Başka bir sorunuz varsa <Link href="/iletisim">iletişim formunu</Link>{" "}
          kullanabilirsiniz.
        </p>
      </section>
    </>
  );
}
