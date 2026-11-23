---
type: Playbook
title: Pilot Readiness Checklist
description: Local demo/pilot verification checklist for Faz 9B before presenter walkthrough.
tags: [playbook, pilot, phase9b, verification]
timestamp: 2026-07-09T22:10:00Z
---

# Pilot Readiness Checklist

Use this checklist before a local demo or pilot walkthrough. It does not claim production readiness, medical validation, or legal compliance.

## Teknik hazırlık

- [ ] Local environment doğrulandı (`npm install`, `.env.local` from `.env.example`)
- [ ] Node.js sürümü proje hedefiyle uyumlu (Node 24 LTS)
- [ ] Local Supabase çalışıyor (`npm run supabase:status`)
- [ ] `npm run verify:phase9b` PASS (veya aşağıdaki alt adımlar tek tek PASS)
- [ ] `npm run db:reset` başarılı
- [ ] Migration integrity başarılı (`npm run verify:migration-integrity`)
- [ ] `npm run db:lint` başarılı
- [ ] pgTAP başarılı (`npm run test:db`)
- [ ] RLS başarılı (`npm run test:rls:local`)
- [ ] Unit başarılı (`npm test`)
- [ ] lint / typecheck / build / audit başarılı
- [ ] Base-state E2E regresyonları başarılı (Faz 5–8, 9B UI polish)
- [ ] Demo-state E2E başarılı (`test:e2e:phase9b-demo`, golden journey)
- [ ] `npm run demo:setup` başarılı
- [ ] `npm run demo:reset` başarılı

## Demo hesabı ve veri

- [ ] Yalnız sentetik `.test` hesaplar kullanılıyor
- [ ] Gerçek danışan adı, telefonu veya adresi yok
- [ ] Gerçek hasta fotoğrafı yok
- [ ] Raw portal token dokümana veya commit’e yazılmıyor
- [ ] Secure link demo sırasında UI üzerinden oluşturuluyor
- [ ] Demo reset adımları biliniyor (`npm run demo:reset`)

| Rol | E-posta | Parola |
|-----|---------|--------|
| Owner | `demo-owner@example.test` | `local-test-password` |
| Admin | `demo-admin@example.test` | `local-test-password` |
| Staff | `demo-staff@example.test` | `local-test-password` |

## Pilot sunum kontrolü

- [ ] Login (`/login`)
- [ ] Dashboard (`/clinic`)
- [ ] Danışan listesi ve detay
- [ ] İşlem / plan bağlamı
- [ ] Bakım planı detayı
- [ ] Görev durumu (portal)
- [ ] Structured check-in
- [ ] Alert inceleme
- [ ] Fotoğraf talebi oluşturma (owner/admin)
- [ ] Fotoğraf upload (portal) ve güvenli görüntüleme (klinik)
- [ ] Consent/notice kararı
- [ ] Veri talebi (portal → klinik)
- [ ] Yetki farkları (staff read-only alanlar)
- [ ] Mobil görünüm (375–768 px smoke)

## Ürün sınırları (sunumda açıkça belirt)

- Teşhis yapmaz
- Fotoğraftan otomatik yorum üretmez
- Tedavi önermez
- Otomatik komplikasyon tespiti yapmaz
- Hukuki/KVKK uyumluluğu iddia etmez
- Gerçek production deployment değildir
- Bildirim, randevu, ödeme ve analitik henüz yoktur

## Pilot sonrası

- [ ] Geri bildirim notu alındı
- [ ] Bug kaydı açıldı (severity/priority ile)
- [ ] Gerçek hasta verisi kullanılmadı doğrulandı
- [ ] Yeni özellik istekleri roadmap’e yazıldı (Faz 10+)
- [ ] Güvenlik olayları ayrı kanaldan ele alındı

## İlgili belgeler

- [Demo runbook](demo-runbook.md)
- [Pilot user guide](pilot-user-guide.md)
- [Phase 9B acceptance matrix](../references/phase9b-acceptance-matrix.md)
- [Master roadmap](../product/master-roadmap.md)
