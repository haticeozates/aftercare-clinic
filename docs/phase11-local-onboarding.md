# Phase 11 · Yerel kayıt ve klinik kurulumu

Phase 11, AfterCare Clinic Portfolio Edition için yalnızca sentetik hesaplarla çalışır.
Ana Supabase yapılandırmasında hesap kaydı kapalıdır. Uygulama kayıt,
parola kurtarma, kurulum ve ekip yönetimini sadece açıkça etkinleştirilmiş
yerel ortamda gösterir.

## Doğrulama ortamı

Stage 2'nin izole test kopyasında Supabase proje kimliğini
`aftercare-portfolio-stage2-test` ve API, DB, Mailpit portlarını sırasıyla
`56321`, `56322`, `56324` olarak koruyun. Uygulama terminalinden
`node scripts/configure-phase11-test.mjs` komutunu çalıştırın. Bu komut
ana depo yapılandırmasını reddeder ve sadece test kopyasında yerel e-posta
doğrulamasını ve Mailpit'i açar.

Aşağıdaki değerler, doğrulanmış test ortamı değerlerine eklenir.

```dotenv
APP_ENV=development
PHASE11_DEMO_ENABLED=true
PHASE11_APP_ORIGIN=http://localhost:3000
PHASE11_MAILPIT_ORIGIN=http://127.0.0.1:56324
AFTERCARE_PUBLIC_SITE_URL=http://localhost:3000
```

Supabase'i test kopyasından başlatın. Görev ve sıfırlama komutlarından önce
Docker'da test veritabanının proje adını ve port eşleşmesini doğrulayın.
Uygulamayı loopback üzerinde çalıştırın. Stage 2 Linux Chromium harness'ını
kullanıyorsanız uygulamayı bu ayarlarla derleyin ve mevcut tarayıcı köprüsünü kullanın.

- `npm run test:db` ve `npm run test:rls:local` SQL ve erişim politikalarını denetler.
- `PHASE11_DB_INTEGRATION=true npm run test:integration` eşzamanlı kurulumu izole
  test DB'sinde sınar.
- `npm run test:e2e:phase11` doğrulama, kurtarma ve ekip davetlerini gerçek sentetik
  e-postalarla doğrular. İsteğe bağlı `PHASE11_SCREENSHOTS_DIR` sentetik ekran
  görüntülerinin kaydedileceği özel dizindir.

## Yetki kuralları

Klinik oluşturma doğrulanmış e-postaya ve kayıt akışında açılmış kurulum
kaydına bağlıdır. Kurulum, profil ve ilk işletme sahibi tek işlemde oluşturulur.
Davet gönderimi Mailpit kabulüyle doğrulanır. Davet yenileme önceki bağlantıyı
geçersiz kılar. Davet edilen hesap bağlantıyı yalnızca bir kez ve 48 saat içinde
kullanabilir. Her hesap aynı anda tek bir etkin klinik üyeliği alabilir.

İşletme sahibi, işletme sahibi dahil ekip üyelerini yönetebilir. Yöneticiler
uzman davet edebilir ve uzman erişimini kapatabilir. Uzmanlar yönetim
ekranlarına erişemez. Son etkin işletme sahibi doğrudan ya da uygulama
üzerinden yapılan güncellemeyle görevden alınamaz.

Klinik saat dilimi profil bilgisidir. Mevcut bakım planı zamanlaması
İstanbul saatini kullanır. Üretim SMTP'si ve herkese açık kayıt bu aşamada
yapılandırılmamıştır.
