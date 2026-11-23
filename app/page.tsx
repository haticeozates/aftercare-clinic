import Link from "next/link";
import { connection } from "next/server";
import { PublicShell } from "@/components/public-site/shell";
import {
  DemoBand,
  FaqList,
  FeatureList,
  ProductView,
  OperationsGallery,
  WorkflowList
} from "@/components/public-site/sections";
import { phase11Config } from "@/lib/phase11/config";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/");

export default async function HomePage() {
  await connection();
  return (
    <PublicShell>
      <section className="ac-hero">
        <div className="ac-wrap ac-hero-grid">
          <div className="ac-hero-copy">
            <p className="ac-kicker">
              <span aria-hidden="true" /> İşlem sonrası bakım takibi
            </p>
            <h1>
              Klinikten eve,
              <br />
              <em>bakım devam eder.</em>
            </h1>
            <p className="ac-lede">
              Bakım planları, günlük görevler ve danışan bildirimleri klinik ekibiniz için
              tek bir takip akışında.
            </p>
            <div className="ac-actions">
              <Link href="/demo" className="ac-button ac-button-primary">
                Demo talep et <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/nasil-calisir" className="ac-button ac-button-outline">
                Nasıl çalışır? <span aria-hidden="true">→</span>
              </Link>
            </div>
            {phase11Config() && <Link href="/kayit" className="ac-text-link">Klinik demo hesabı oluştur <span aria-hidden="true">↗</span></Link>}
            <p className="ac-hero-note">
              Klinik ekibine panel. Danışana süreli güvenli bağlantı.
            </p>
          </div>
          <ProductView />
        </div>
      </section>
      <section className="ac-section ac-wrap">
        <div className="ac-section-heading">
          <div>
            <p className="ac-kicker">
              <span aria-hidden="true" /> Bakım araçları
            </p>
            <h2>Her planın bir devamı var.</h2>
          </div>
          <Link className="ac-text-link" href="/ozellikler">
            Tüm özellikler <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <FeatureList preview />
      </section>
      <section className="ac-workflow-section">
        <div className="ac-wrap ac-section ac-split">
          <div>
            <p className="ac-kicker">
              <span aria-hidden="true" /> Klinik ve danışan akışı
            </p>
            <h2>
              İlk şablondan
              <br />
              günlük takibe.
            </h2>
            <p>
              Klinikte oluşturulan plan, danışanın evde açabileceği bir takip rehberine
              dönüşür.
            </p>
            <Link className="ac-text-link" href="/kullanim-senaryolari">
              Kullanım senaryoları <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <WorkflowList />
        </div>
      </section>
      <OperationsGallery />
      <section className="ac-section ac-wrap">
        <div className="ac-security">
          <div>
            <p className="ac-kicker">
              <span aria-hidden="true" /> Erişim ve gizlilik
            </p>
            <h2>Her kayıt, yetkili kişilere görünür.</h2>
          </div>
          <div>
            <p>
              Klinik kayıtları organizasyon bazında ayrılır. Danışan portalı süreli
              bağlantı ve oturumla açılır. Klinik, bağlantıyı iptal ederek portal
              erişimini kapatabilir.
            </p>
            <Link className="ac-text-link" href="/gizlilik">
              Gizlilik yaklaşımı <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>
      <section className="ac-section ac-wrap ac-split ac-home-faq">
        <div>
          <h2>Merak edilenler</h2>
          <Link className="ac-text-link" href="/sss">
            Tüm sorular <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <FaqList preview />
      </section>
      <DemoBand />
    </PublicShell>
  );
}
