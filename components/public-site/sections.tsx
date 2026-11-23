import Image from "next/image";
import Link from "next/link";
import { features, questions, workflow } from "@/lib/public-site/content";

export function PublicIntro({
  label,
  title,
  children
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ac-intro">
      <div className="ac-wrap">
        <p className="ac-kicker">
          <span aria-hidden="true" />
          {label}
        </p>
        <h1>{title}</h1>
        <p className="ac-lede">{children}</p>
      </div>
    </section>
  );
}

export function ProductView({ compact = false }: { compact?: boolean }) {
  return (
    <figure className={`ac-product${compact ? " ac-product-compact" : ""}`}>
      <div className="ac-product-stage">
        <div className="ac-desktop">
          <div className="ac-window" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>AfterCare Clinic</span>
          </div>
          <Image
            src="/aftercare/clinic.webp"
            width={1120}
            height={760}
            unoptimized
            preload={!compact}
            alt="Sentetik klinik paneli. Sol tarafta navigasyon, ana alanda bakım takibi ve günün planları."
          />
        </div>
        <div className="ac-phone">
          <Image
            src="/aftercare/portal.webp"
            width={390}
            height={630}
            unoptimized
            preload={!compact}
            alt="Sentetik danışan portalı. Günlük görevler ve durum bildirimi alanı."
          />
        </div>
      </div>
      <figcaption>
        <span>Klinik paneli</span>
        <span>Danışan portalı</span>
        <span>Sentetik ürün görüntüleri</span>
      </figcaption>
    </figure>
  );
}

export function OperationsGallery() {
  return (
    <section id="urun-galerisi" className="ac-section ac-wrap ac-operations" aria-labelledby="ac-operations-title">
      <div className="ac-section-heading">
        <div>
          <p className="ac-kicker"><span aria-hidden="true" /> Klinik panelinden</p>
          <h2 id="ac-operations-title">Takvim ve raporlar</h2>
        </div>
        <p>Sentetik verilerle çalışan ürün ekranları.</p>
      </div>
      <div className="ac-operations-grid">
        <figure>
          <Image src="/aftercare/takvim-operasyon.jpg" alt="Dolu haftalık takvimde seçili gün ve farklı randevu durumları."
            width={1045} height={650} unoptimized />
          <figcaption><h3>Randevu takvimi</h3><p>Günün planını, bekleyen talepleri ve randevu durumlarını bir arada görün.</p></figcaption>
        </figure>
        <figure>
          <Image src="/aftercare/analitik-operasyon.jpg" alt="Randevu ve bakım katılımı için dönem karşılaştırmalı klinik raporu."
            width={1045} height={650} unoptimized />
          <figcaption><h3>Operasyon raporları</h3><p>Randevu hacmini, görev tamamlamayı ve check-in katılımını izleyin.</p></figcaption>
        </figure>
      </div>
    </section>
  );
}

export function FeatureList({ preview = false }: { preview?: boolean }) {
  return (
    <div className="ac-feature-grid">
      {(preview ? features.slice(0, 3) : features).map(([icon, title, body]) => (
        <article className="ac-feature" key={title}>
          <span className={`ac-icon ac-icon-${icon}`} aria-hidden="true" />
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
    </div>
  );
}

export function WorkflowList() {
  return (
    <ol className="ac-workflow">
      {workflow.map(([title, description]) => (
        <li key={title}>
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function FaqList({ preview = false }: { preview?: boolean }) {
  return (
    <div className="ac-faq">
      {(preview ? questions.slice(0, 3) : questions).map(([question, answer]) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}

export function DemoBand() {
  return (
    <section className="ac-demo-band">
      <div className="ac-wrap ac-demo-inner">
        <div>
          <h2>Takip akışını birlikte inceleyelim.</h2>
          <p>
            Klinik panelini ve danışanın günlük bakım deneyimini sentetik bir örnek
            üzerinden görün.
          </p>
        </div>
        <Link href="/demo" className="ac-button ac-button-light">
          Demo talep et <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
