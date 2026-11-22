import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Db } from "./types";

const globalForDb = globalThis as unknown as { berberDb?: Db };

/**
 * Veritabanı bağlantısını ilk kullanıldığında açar. Derleme sırasında
 * (DATABASE_URL yokken) dosyanın içe aktarılması hata vermez.
 */
export function getDb(): Db {
  if (globalForDb.berberDb) return globalForDb.berberDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL tanımlı değil. .env.local dosyasını kontrol edin (bkz. .env.example).");
  }
  // Supabase'in "transaction pooler" bağlantısı hazır sorguları (prepared
  // statements) desteklemediği için kapatılır. Dizi tipleri kullanmadığımız
  // için her yeni bağlantıda tip listesi de çekilmez (fetch_types).
  const max = Number(process.env.DATABASE_POOL_MAX ?? 5) || 5;
  const sql = postgres(url, { prepare: false, fetch_types: false, max });
  const db: Db = drizzle(sql, { schema });

  // Geliştirme sırasında her kod değişikliğinde yeni bağlantı açılmasın.
  globalForDb.berberDb = db;
  return db;
}
