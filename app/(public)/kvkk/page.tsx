import { LegalPage } from "@/components/public-site/legal";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/kvkk");

export default function Page() {
  return (
    <LegalPage title="KVKK aydınlatma metni">
      <h2>Metnin kapsamı</h2>
      <p>
        Bu taslak, AfterCare Clinic tanıtım sitesinin demo ve iletişim formlarını kapsar.
        Klinik ve danışan portalındaki veri işleme süreçleri ayrıca ele alınmalıdır.
      </p>
      <h2>Toplanan bilgiler ve amaç</h2>
      <p>
        Form türüne bağlı olarak ad soyad, e-posta, klinik veya kurum adı ya da mesaj
        içeriği talebinizi kaydetmek için kullanılır. Formlara hasta veya sağlık verisi
        yazmayın.
      </p>
      <h2>Yayın öncesi tamamlanacak alanlar</h2>
      <p>
        Veri sorumlusu kimliği, hukuki sebep, aktarım alıcıları, toplama yöntemi, saklama
        süresi ve ilgili kişi başvuru kanalı kesinleştirilecektir.
      </p>
    </LegalPage>
  );
}
