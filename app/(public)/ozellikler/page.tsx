import { PublicIntro, FeatureList, DemoBand } from "@/components/public-site/sections";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/ozellikler");

export default function Page() {
  return (
    <>
      <PublicIntro label="Özellikler" title="Bakımın her adımı bir arada.">
        Klinik ekibinin bakım planı oluşturması ve danışanın günlük takibe katılması için
        kullanılan ürün araçları.
      </PublicIntro>
      <section className="ac-wrap ac-section">
        <h2>Bakım takibi araçları</h2>
        <FeatureList />
      </section>
      <DemoBand />
    </>
  );
}
