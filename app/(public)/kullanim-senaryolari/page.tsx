import { DemoBand, PublicIntro } from "@/components/public-site/sections";
import { useCases } from "@/lib/public-site/content";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/kullanim-senaryolari");

export default function UseCasesPage() {
  return (
    <>
      <PublicIntro
        label="Klinik kullanım senaryoları"
        title="Bakım sürecine uyum sağlayan takip."
      >
        Klinik ekiplerinin mevcut araçlarla oluşturabileceği üç örnek iş akışı.
      </PublicIntro>
      <section className="ac-wrap ac-section">
        <h2>Klinik ekipleri neler yapabilir?</h2>
        <div className="ac-feature-grid">
          {useCases.map(([title, body]) => (
            <article className="ac-feature" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <DemoBand />
    </>
  );
}
