import Link from "next/link";
import { PublicIntro } from "@/components/public-site/sections";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/fiyatlandirma");

export default function PricingPage() {
  return (
    <>
      <PublicIntro label="Fiyatlandırma" title="Portföy Sürümü kapsamı.">
        Fiyatlandırma henüz belirlenmedi. Mevcut ürün akışını demo ile inceleyebilirsiniz.
      </PublicIntro>
      <section className="ac-wrap ac-section ac-split">
        <div>
          <h2>Demo kapsamı</h2>
          <p>Örnek bir bakım planı üzerinden klinik ve danışan deneyimini görün.</p>
        </div>
        <div className="ac-price-card">
          <p className="ac-kicker">
            <span aria-hidden="true" />
            Fiyatlandırma taslağı
          </p>
          <h3>AfterCare Clinic</h3>
          <ul>
            <li>Bakım şablonları ve planlar</li>
            <li>Güvenli danışan portalı ve günlük görevler</li>
            <li>Check-in, fotoğraf takibi ve klinik bildirimleri</li>
            <li>Onam ve veri talepleri</li>
          </ul>
          <Link className="ac-button ac-button-primary" href="/demo">
            Demo talep et <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </>
  );
}
