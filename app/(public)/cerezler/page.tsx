import { LegalPage } from "@/components/public-site/legal";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/cerezler");

export default function Page() {
  return (
    <LegalPage title="Çerez politikası">
      <h2>Tanıtım sayfaları</h2>
      <p>
        Tanıtım sayfası kodu reklam veya analiz çerezi oluşturmaz. Formlar kötüye
        kullanıma karşı sunucu tarafında hız sınırı uygular.
      </p>
      <h2>Klinik ve portal oturumları</h2>
      <p>
        Klinik girişi ve danışan portalında oturumun sürdürülmesi için gerekli oturum
        çerezleri kullanılır. Danışan portalının süresi bağlantı ve oturum kurallarına
        bağlıdır.
      </p>
      <h2>Tarayıcı ayarları</h2>
      <p>
        Çerezleri tarayıcı ayarlarınızdan yönetebilirsiniz. Oturum çerezlerini engellemek
        klinik veya danışan portalının çalışmasını etkileyebilir.
      </p>
    </LegalPage>
  );
}
