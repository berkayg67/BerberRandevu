-- Aynı ustanın aktif randevuları üst üste binemez.
-- Aralık [başlangıç, bitiş + boşluk) olarak kontrol edilir; bitişik randevular serbesttir.
-- İki istek aynı anda gelse bile veritabanı ikincisini reddeder (hata kodu 23P01).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    tstzrange("starts_at", "blocked_until", '[)') WITH &&
  )
  WHERE ("status" = 'active');
