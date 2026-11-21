# BerberRandevu

Mahalle berberleri için online randevu sistemi. Müşteri telefonla aramadan randevusunu alır; berber gününü tek ekrandan yönetir; onay, hatırlatma, iptal ve teşekkür mesajları WhatsApp'tan gider.

## Gereksinimler

- Node.js 20.9 veya üstü (önerilen: 22)
- Git

## Kurulum

```bash
npm install
npm run dev
```

Ardından tarayıcıda http://localhost:3000 adresini açın.

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusunu başlatır |
| `npm run build` | Üretim derlemesi yapar |
| `npm run start` | Derlenmiş uygulamayı çalıştırır |
| `npm run lint` | ESLint ile kod kontrolü |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm run check` | Lint ve tip kontrolünü birlikte çalıştırır |

## Sürekli entegrasyon

`.github/workflows/ci.yml` her `main` push'unda ve her pull request'te lint, tip kontrolü ve derlemeyi çalıştırır.

## Yol haritası

1. Proje iskeleti ve CI
2. Tasarım sistemi, aydınlık / karanlık mod
3. Veri katmanı: randevu, müşteri, mesaj kuyruğu, çakışma ve engelleme kuralları
4. Müşteri sayfası: randevu alma ve "Randevularım"
5. Berber paneli: takvim, mesajlar, müşteriler, ayarlar
6. Gerçek veritabanı (Supabase / PostgreSQL) ve WhatsApp Business API
