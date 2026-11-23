import { LegalPage } from "@/components/public-site/legal";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/kullanim-kosullari");

export default function Page() {
  return (
    <LegalPage title="Kullanım koşulları">
      <h2>Portföy Sürümü</h2>
      <p>
        Tanıtım sitesi ürünü tanıtır ve ürün hakkında demo talebi veya mesaj kaydeder.
        Demo ekranları örnek klinik ve danışan kayıtlarıyla hazırlanmıştır.
      </p>
      <h2>Bakım takibi</h2>
      <p>
        AfterCare Clinic bakım görevlerini ve danışan bildirimlerini düzenlemeye yardımcı
        olur. Tıbbi değerlendirme ve tedavi kararları ilgili sağlık profesyoneline aittir.
      </p>
      <h2>Klinik ve danışan erişimi</h2>
      <p>
        Klinik hesapları yalnızca yetkili kullanıcılar tarafından kullanılmalıdır. Danışan
        bağlantıları kişiye özeldir ve klinik tarafından iptal edilebilir.
      </p>
      <h2>Ticari koşullar</h2>
      <p>Portföy Sürümü’nün fiyatları ve ticari hizmet koşulları henüz belirlenmedi.</p>
    </LegalPage>
  );
}
