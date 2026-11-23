---
type: Playbook
title: Pilot User Guide
description: Plain-language guide for clinic staff walking through the local AfterCare Clinic demo.
tags: [playbook, pilot, user-guide, phase9b]
timestamp: 2026-07-09T22:10:00Z
---

# AfterCare Clinic — Pilot Kullanım Rehberi

Bu rehber yerel demo/pilot sunumu içindir. Teknik geliştirici dokümanı değildir. Gerçek hasta verisi veya production ortamı için kullanılmamalıdır.

## 1. AfterCare Clinic nedir?

Kliniklerin bakım planı, danışan portalı, fotoğraf talebi, onay belgeleri ve veri taleplerini tek panelde yönetmesine yardımcı olan bir klinik takip uygulamasıdır.

## 2. Neleri yapar?

- Danışan ve işlem kayıtlarını görüntüler
- Bakım planı ve günlük görevleri yönetir
- Danışana güvenli portal bağlantısı oluşturur
- Portal üzerinden görev, check-in ve fotoğraf talebini toplar
- Takip bildirimlerini listeler
- Onay/bilgilendirme belgelerini atar ve kararları görür
- Veri taleplerini klinik workflow’unda inceler

## 3. Neleri yapmaz?

- Teşhis veya tedavi önerisi sunmaz
- Fotoğrafları otomatik yorumlamaz
- Hukuki/KVKK uyumluluk garantisi vermez
- E-posta, SMS veya WhatsApp bildirimi göndermez
- Randevu takvimi veya ödeme işlemi yapmaz

## 4. Klinik paneline giriş

1. `http://localhost:3000/login` adresini açın
2. Demo owner hesabıyla giriş yapın: `demo-owner@example.test` / `local-test-password`
3. **Demo Pilot Clinic** organizasyonuna yönlendirildiğinizi doğrulayın

## 5. Danışan ve işlem görüntüleme

- **Danışanlar** menüsünden **Synthetic Demo Client** kaydını açın
- İletişim bilgilerinin yalnızca sentetik `.test` verisi olduğunu unutmayın
- Aktif bakım planında **Demo Procedure One** bağlamını görün

## 6. Bakım planını görüntüleme

- **Bakım Planları** → demo planını açın
- Plan günleri, görevler ve mevcut fotoğraf taleplerini inceleyin
- Plan durumu ve tarihleri Türkçe biçimde gösterilir

## 7. Fotoğraf talebi oluşturma

- Plan detayında **Fotoğraf talebi oluştur** bölümünü kullanın (owner/admin)
- Aktif talebi olmayan bir gün seçin
- Kısa, tarafsız bir açıklama girin; teşhis veya tedavi metni yazmayın
- **Talep oluştur** ile kaydedin

## 8. Secure portal link oluşturma

- Aynı plan detayında **Güvenli bağlantı oluştur** (veya gerekirse **Bağlantıyı yenile**) kullanın
- Tek seferlik bağlantıyı yalnızca demo oturumunda kopyalayın
- Bağlantıyı dokümana veya e-postaya yapıştırmayın; repository’ye kaydetmeyin

## 9. Danışan portal akışı

- Kopyaladığınız bağlantıyı yeni bir tarayıcı sekmesinde açın
- **Bakım Planınız** ekranında bugünün görevlerini görün

## 10. Görev ve check-in takibi

- Görevleri tamamlayın veya **Geri al** ile durumu değiştirin
- **Bugünkü durumunuzu kliniğinizle paylaşın** bölümünden structured check-in gönderin
- Bu ekran tıbbi değerlendirme sunmaz; yalnızca kliniğe iletilmek üzere kayıt oluşturur

## 11. Alert inceleme

- Klinik panelinde **Takip Bildirimleri** menüsünü açın
- Yalnızca Demo Pilot Clinic kapsamındaki kayıtları görmelisiniz

## 12. Fotoğraf görüntüleme

- Portalda sentetik bir test görseli yükleyin
- Klinik plan detayında **Güvenli görüntüle** ile kısa süreli görüntülemeyi açın
- Depolama yolu veya kalıcı imzalı URL kopyalanmamalıdır

## 13. Consent/notice işlemleri

- Portalda **Belgeler ve tercihlerim** bölümünden temsili bilgilendirme belgesini açın
- Belge türüne göre **Okudum / Görüntüledim**, kabul veya ret seçeneklerini kullanın
- Metinler yalnızca demo amaçlıdır; gerçek hukuki metin değildir

## 14. Veri talebi workflow’u

- Portalda **Verilerimle ilgili talep oluştur** formunu kullanın
- Talep türünü seçin ve onay kutusunu işaretleyin
- Klinikte **Veri Talepleri** ekranından kaydı inceleyin, atayın veya durumunu güncelleyin

## 15. Roller ve yetkiler

| Rol | Tipik yetki |
|-----|-------------|
| Owner | Tam klinik yönetimi, fotoğraf talebi, bağlantı, veri talebi inceleme |
| Admin | Owner’a yakın operasyonel yetkiler |
| Staff | Görüntüleme; fotoğraf talebi oluşturma ve veri talebi yönetimi yok |

Staff hesabıyla (`demo-staff@example.test`) yasak alanların gizlendiğini doğrulayın.

## 16. Demo verisini sıfırlama

```bash
npm run demo:reset
```

Bu komut veritabanını temizler ve demo fixture’ını yeniden yükler.

## 17. Sorun bildirimi

- Teknik hata kodunu ekran görüntüsüyle birlikte geliştirme ekibine iletin
- Gerçek hasta verisi eklemeyin
- Güvenlik şüphesi varsa ayrı güvenlik kanalını kullanın

## 18. Gizlilik ve gerçek veri uyarısı

Bu pilot yalnızca sentetik veri içindir. Gerçek danışan adı, iletişim bilgisi, fotoğraf veya hukuki metin kullanmayın.

## 19. Bilinen sınırlamalar

- Production deployment ve remote Supabase yoktur
- Bildirim, randevu, ödeme ve platform admin henüz yoktur
- Public website ve self-service onboarding Faz 10+ planındadır
- Tam hukuki/KVKK incelemesi yapılmamıştır

Detaylı teknik doğrulama için [pilot readiness checklist](pilot-readiness-checklist.md) ve `npm run verify:phase9b` kullanın.
