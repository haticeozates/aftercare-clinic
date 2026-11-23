export const siteName = "AfterCare Clinic";
export const siteDescription =
  "Klinikler için işlem sonrası bakım planları, güvenli danışan portalı ve yapılandırılmış takip.";

export const publicPages = {
  "/": { title: "Klinikten eve, bakım devam eder", description: siteDescription },
  "/ozellikler": {
    title: "Özellikler",
    description:
      "Bakım planları, danışan portalı, fotoğraf paylaşımı ve klinik takip araçları."
  },
  "/nasil-calisir": {
    title: "Nasıl çalışır?",
    description:
      "Bir bakım şablonundan güvenli danışan takibine uzanan işlem sonrası bakım akışı."
  },
  "/kullanim-senaryolari": {
    title: "Kullanım senaryoları",
    description:
      "Klinik ekiplerinin işlem sonrası bakım takibini düzenleyebileceği üç örnek akış."
  },
  "/fiyatlandirma": {
    title: "Fiyatlandırma",
    description: "AfterCare Clinic Portföy Sürümü için fiyatlandırma ve demo bilgisi."
  },
  "/sss": {
    title: "Sıkça sorulan sorular",
    description:
      "Danışan erişimi, güvenli bağlantılar, fiyatlandırma ve demo hakkında yanıtlar."
  },
  "/demo": {
    title: "Demo talep et",
    description:
      "AfterCare Clinic’in sentetik verilerle hazırlanan ürün demosu için talep oluşturun."
  },
  "/iletisim": {
    title: "İletişim",
    description: "AfterCare Clinic hakkında bir soru veya geri bildirim kaydedin."
  },
  "/hakkinda": {
    title: "Hakkında",
    description: "AfterCare Clinic Portföy Sürümü’nün amacı ve ürün yaklaşımı."
  },
  "/gizlilik": {
    title: "Gizlilik politikası",
    description: "Portföy Sürümü tanıtım sitesi ve formları için gizlilik taslağı."
  },
  "/kullanim-kosullari": {
    title: "Kullanım koşulları",
    description: "AfterCare Clinic Portföy Sürümü için kullanım koşulları taslağı."
  },
  "/kvkk": {
    title: "KVKK aydınlatma metni",
    description: "Portföy Sürümü için KVKK aydınlatma metni taslağı."
  },
  "/cerezler": {
    title: "Çerez politikası",
    description:
      "Public site, klinik oturumu ve danışan portalı için çerez politikası taslağı."
  }
} as const;

export type PublicPath = keyof typeof publicPages;

export const mainLinks = [
  ["/ozellikler", "Özellikler"],
  ["/nasil-calisir", "Nasıl çalışır?"],
  ["/kullanim-senaryolari", "Kullanım senaryoları"],
  ["/fiyatlandirma", "Fiyatlandırma"]
] as const;

export const features = [
  [
    "plan",
    "Bakım planları",
    "Klinik ekibi yayımlanmış şablonlardan danışana özel planlar oluşturur. Her plan kendi gün ve görev kayıtlarını korur."
  ],
  [
    "link",
    "Danışan portalı",
    "Danışan, klinikten aldığı süreli bağlantıyla hesabı olmadan planını açar ve günlük görevlerini işaretler."
  ],
  [
    "pulse",
    "Yapılandırılmış check-in",
    "Danışanın seçtiği belirtiler ve şiddet düzeyi klinik ekibine ulaşır. Şablon kuralları, değerlendirme bekleyen bildirimleri oluşturur."
  ],
  [
    "image",
    "Fotoğraf takibi",
    "Klinik belirli bir plan günü için fotoğraf isteyebilir. Yüklenen fotoğrafı yetkili ekip üyeleri süreli bağlantıyla görüntüler."
  ],
  [
    "file",
    "Onam ve veri talepleri",
    "Klinik belge sürümlerini danışana atayabilir. Danışan portalda tercihlerini kaydeder ve veri talebi oluşturabilir."
  ],
  [
    "shield",
    "Klinik bazlı erişim",
    "Klinik kayıtları organizasyona göre ayrılır. Yetkili ekip, güvenli bağlantıları yenileyebilir veya açık portal oturumuyla birlikte iptal edebilir."
  ]
] as const;

export const workflow = [
  [
    "Şablonu hazırlayın",
    "Klinik işlem türüne uygun günleri, görevleri ve belirti seçeneklerini belirleyip şablonu yayımlar."
  ],
  [
    "Planı oluşturup bağlantıyı paylaşın",
    "Klinik, şablondan danışana özel planı başlatır ve süreli güvenli bağlantıyı kendi iletişim kanalıyla iletir."
  ],
  [
    "Danışan evde planı takip eder",
    "Danışan günlük görevlerini açar, check-in gönderir ve klinik istediğinde fotoğraf yükler."
  ],
  [
    "Klinik ekibi kayıtları inceler",
    "Yapılandırılmış bildirimler ve talep edilen fotoğraflar yetkili ekibe görünür."
  ]
] as const;

export const useCases = [
  [
    "İşlem sonrası ilk günler",
    "Klinik, işlemden sonraki günleri ve izlenecek adımları tek bir bakım planında toplar. Danışan zamanı geldiğinde ilgili görevleri portalda görür."
  ],
  [
    "Belirti ve fotoğraf takibi",
    "Klinik check-in sorularını şablona ekler, gerektiğinde fotoğraf ister. Yetkili ekip yapılandırılmış kayıtları ve görüntüleri panelde inceler."
  ],
  [
    "Onam ve veri talepleri",
    "Klinik güncel belge sürümünü plana atar. Danışan kararını portalda kaydeder ve veri talebi oluşturabilir. Ekip talepleri panel üzerinden değerlendirir."
  ]
] as const;

export const questions = [
  [
    "Danışanın hesabı olması gerekiyor mu?",
    "Danışan klinikten aldığı süreli bağlantıyı kullanır. Klinik ekibi kendi hesabıyla /login üzerinden giriş yapar."
  ],
  [
    "Klinik bir bağlantıyı iptal edebilir mi?",
    "Yetkili ekip bağlantıyı iptal edebilir veya yenileyebilir. Bağlantıya bağlı açık portal oturumları da geçersiz olur."
  ],
  [
    "Fotoğrafları kimler görüntüleyebilir?",
    "Yetkili klinik ekibi kendi organizasyonunun ilgili planına ait fotoğrafları süreli görüntüleme bağlantısıyla açabilir."
  ],
  [
    "Demo nasıl çalışıyor?",
    "Demo, klinik paneli ve danışan portalını sentetik kayıtlarla gösterir. Demo formu talebinizi kaydeder."
  ],
  [
    "Fiyatlar belli mi?",
    "Portföy Sürümü için fiyatlandırma henüz belirlenmedi. Fiyatlandırma sayfasında kapsamı inceleyebilir ve demo talebi oluşturabilirsiniz."
  ],
  [
    "Ürün klinik değerlendirme yapıyor mu?",
    "Danışan bildirimleri klinik ekibine iletilir. Ürün bakım takibini düzenler ve klinik değerlendirmesi ekip tarafından yapılır."
  ]
] as const;
