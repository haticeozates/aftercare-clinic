import { PublicIntro, DemoBand } from "@/components/public-site/sections";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/hakkinda");

export default function Page() {
  return (
    <>
      <PublicIntro
        label="AfterCare Clinic"
        title="İşlem sonrası takibe odaklanan bir ürün."
      >
        AfterCare Clinic, kliniklerin bakım planlarını ve danışan geri bildirimlerini
        işlem sonrasında da düzenleyebilmesi için geliştirildi.
      </PublicIntro>
      <section className="ac-wrap ac-section ac-readable">
        <h2>Portföy Sürümü</h2>
        <p>
          Bu sürüm, bakım şablonundan danışan oturumuna, günlük görevlerden klinik
          incelemesine kadar olan akışı sentetik örneklerle gösterir.
        </p>
        <h2>Klinik ve danışan için iki ayrı deneyim</h2>
        <p>
          Klinik ekibi planları ve kayıtları panelden yönetir. Danışan, klinikten aldığı
          bağlantıyla kendisine ayrılan bakım planını açar.
        </p>
      </section>
      <DemoBand />
    </>
  );
}
