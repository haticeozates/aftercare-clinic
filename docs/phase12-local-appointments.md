# Phase 12 · Randevular ve takvim

Klinik menüsündeki **Randevular** bağlantısı ay, hafta, gün ve ajanda
görünümlerini açar. Danışan geçmişi ve paneldeki yaklaşan randevular aynı
kayıtları kullanır. Geçmiş tarih, danışan, uzman ve durumla filtrelenebilir.

## Müsaitlik ve durumlar

Klinik ve uzman için haftalık bir çalışma aralığı gereklidir. Randevunun
başlangıç ve bitişi her iki programın da içinde olmalıdır. Haftalık mola
ve tek tarihli izin veya kapanış aralıkları iki programda da geçerlidir.
Müsaitlik veya saat dilimi düzenlemesi yeni rezervasyonlara uygulanır.
Mevcut kayıtların UTC zamanları ve oluşturuldukları saat dilimi korunur.
Takvim, kayıtları kliniğin güncel saat diliminde gösterir. Yaz saati
geçişinde yerel olarak var olmayan saat reddedilir. İki defa görülen yerel
saatte PostgreSQL dönüşümü tek bir UTC karşılığını kullanır.

Online talep **Onay bekliyor** olarak slotu tutar. Onay için klinikteki
bir danışan kaydı eşleştirilir. Ret, iptal, tamamlanma ve gelmedi
durumlarında geçmiş kaydı kalır. Geçmiş bir bekleyen talep onaylanamaz.
Yeni iç randevu doğrudan onaylı başlar. Tamamlandı ve gelmedi işlemleri
randevu saati gelince açılır.

İşletme sahibi ve yönetici klinik takvimi ile müsaitliği yönetebilir.
Uzman, klinik takvimini okuyabilir ve kendisine atanan randevuları
oluşturup yönetebilir. Randevu zaman aralığı ve durum düzenlemeleri
sıralı işlem geçmişine yazılır.

## İzole online demo

Stage 2 ve Phase 11 test kopyası, PostgreSQL `56322`, Supabase API
`56321` ve Mailpit `56324` portlarını kullanır. Çalıştırmadan önce
konteyner proje kimliği ve portları doğrulanmalıdır.

`PHASE12_PUBLIC_DEMO_ENABLED=true` yalnızca yerel uygulama ortamı ve
loopback üzerindeki izole API portuyla yeni public yolu açar. Klinik
müsaitlik ekranından ayrıca klinik bağlantısını ve seçilen işlemleri açar.
Rota `/randevu/<klinik-slug>` biçimindedir. Ziyaretçi yalnızca işlem,
genel uzman etiketi, saat ve `DEMO-1234` biçiminde sentetik kod girer.
Mevcut danışan verileri, uzman adları ve randevu ayrıntıları sunulmaz.

- `PHASE12_DB_INTEGRATION=true npm test` eşzamanlı işlemleri izole DB’de sınar.
- `npm run test:db` SQL, RLS, uygunluk ve durum geçişlerini doğrular.
- `npm run test:e2e:phase12` izolasyon, Mailpit, takvim ve bakım planı bağını doğrular.
- `PHASE12_SCREENSHOTS_DIR` tanımlıysa tarayıcı kanıtları belirtilen yerel dizine kaydedilir.

Tamamlanan işlem randevusundaki bağlantı bakım planı formuna danışanı ve
işlemi aktarır. Plan ancak personel formu onayladığında oluşturulur.
Planın detayından açılan kontrol randevusu, seçilen planı sunucuda
aynı danışan, işlem ve klinikle eşleştirerek bağlar.
