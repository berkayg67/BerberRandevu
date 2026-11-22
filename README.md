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
| `npm test` | Testleri çalıştırır (bellek içi PostgreSQL ile, internet gerekmez) |
| `npm run check` | Lint, tip kontrolü ve testleri birlikte çalıştırır |
| `npm run db:generate` | Şema değişikliğinden yeni göç (migration) dosyası üretir |
| `npm run db:migrate` | Tabloları `.env.local` içindeki veritabanına kurar / günceller |
| `npm run db:seed` | Demo dükkânı (berber-demo) ekler; varsa dokunmaz |
| `npm run db:studio` | Veritabanını tarayıcıda gösteren aracı açar |
| `npm run admin:create -- e-posta "Ad Soyad"` | Yönetici hesabı açar ya da şifresini yeniler; şifreyi bir kez gösterir |

## Klasör yapısı

```
src/
  app/                 Sayfalar (Next.js)
  components/          Arayüz bileşenleri
  lib/domain/          Saf iş kuralları: telefon, saat dilimi, boş saat hesabı, mesaj şablonları
  server/
    booking/           Randevu alma, iptal, "Randevularım" servisleri
    db/                Şema, veritabanı bağlantısı ve göçler (migrations)
tests/
  unit/                İş kuralı testleri
  integration/         Gerçek PostgreSQL (PGlite) üzerinde servis testleri
```

## Veritabanı

PostgreSQL kullanılır (Supabase). Önemli kurallar veritabanının kendisinde de korunur:

- **Çift randevu olamaz.** Aynı ustanın aktif randevuları üst üste binemez (`appointments_no_overlap`). İki istek aynı anda gelse bile ikincisi reddedilir.
- **Satır düzeyi güvenlik (RLS) her tabloda açık.** Supabase'in herkese açık API'si tablolara erişemez; erişim yalnızca sunucudaki koddan yapılır.
- Saatler UTC, para kuruş, telefonlar `5XXXXXXXXX` biçiminde saklanır.

Bağlantı bilgileri `.env.local` dosyasındadır (Git'e gitmez). Örnek: `.env.example`.

## Yönetim paneli

`/admin` adresi yalnızca yönetici hesabıyla açılır. Buradan:

- tüm dükkânlar, aylık ücretleri ve tahsilat durumları görülür,
- yeni dükkân eklenir (varsayılan çalışma saatleri, hizmetler ve bir usta ile),
- dükkân bilgileri düzenlenir, dükkân durdurulur ya da yeniden açılır (durdurulan dükkân müşterilere görünmez),
- her ay için "Tahsil edildi" işaretlenir (tutar, yöntem, not) ya da geri alınır.

İlk yönetici hesabı:

```bash
npm run admin:create -- ornek@mail.com "Ad Soyad"
```

Şifreler scrypt ile özetlenir, oturum anahtarının kendisi veritabanına yazılmaz, oturum 14 gün geçerlidir.

## API

| İstek | Ne yapar |
| --- | --- |
| `GET /api/shops/{slug}` | Dükkân bilgileri, hizmetler, ustalar, çalışma saatleri |
| `GET /api/shops/{slug}/slots?service=&date=&staff=` | Bir günün boş ve dolu saatleri |
| `POST /api/shops/{slug}/appointments` | Randevu alır |
| `POST /api/shops/{slug}/appointments/lookup` | Telefona ait aktif randevular ("Randevularım") |
| `POST /api/shops/{slug}/appointments/{id}/cancel` | Müşterinin kendi randevusunu iptal etmesi |

Hatalar `{ "error": { "code", "message" } }` biçiminde, Türkçe açıklamayla döner.

> Not: "Randevularım" ve iptal şimdilik yalnızca telefon numarasıyla çalışır. Canlıya çıkmadan önce WhatsApp doğrulama kodu ve istek sınırlama eklenecek (7. adım).

## Sürekli entegrasyon

`.github/workflows/ci.yml` her `main` push'unda ve her pull request'te lint, tip kontrolü, testler ve derlemeyi çalıştırır.

## Yol haritası

1. Proje iskeleti ve CI ✅
2. Tasarım sistemi, aydınlık / karanlık mod ✅
3. Backend
   - 3a. Şema, çakışma ve engelleme kuralları, mesaj kuyruğu, testler ✅
   - 3b. Supabase bağlantısı, örnek dükkân verisi, API ✅
4. Yönetim paneli: dükkânlar ve tahsilat ✅
5. Müşteri sayfası: randevu alma ve "Randevularım"
6. Berber paneli ve girişi: takvim, mesajlar, müşteriler, ayarlar
7. WhatsApp Business API ve mesaj gönderen zamanlayıcı
