import { LegalPage } from "@/components/public-site/legal";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/gizlilik");

export default function Page() {
  return (
    <LegalPage title="Gizlilik politikası">
      <h2>Tanıtım sitesi ve formlar</h2>
      <p>
        Demo formu ad soyad, e-posta ve klinik veya kurum adını kaydeder. İletişim formu
        ad soyad, e-posta ve yazdığınız mesajı kaydeder. Bu alanları talebinizi kaydetmek
        için kullanırız.
      </p>
      <h2>Kayıtlara erişim</h2>
      <p>
        Form kayıtları klinik ve danışan kayıtlarından ayrı tutulur. Tanıtım sitesi
        ziyaretçilerinin ve klinik kullanıcılarının form kayıtlarını listeleme yetkisi
        yoktur.
      </p>
      <h2>Kötüye kullanımın sınırlandırılması</h2>
      <p>
        Formları kötüye kullanıma karşı sınırlamak için sunucuda kısa süreli hız sınırı
        sayaçları tutulur. Bu sayaçlarda ham IP adresi veya e-posta yerine anahtarlı
        türetimler kullanılır.
      </p>
      <h2>Yayın öncesi belirlenecek bilgiler</h2>
      <p>
        Veri sorumlusu, işleme koşulları, saklama süreleri ve başvuru kanalları yayına
        geçiş öncesinde hukuki incelemeyle kesinleştirilecektir.
      </p>
    </LegalPage>
  );
}
