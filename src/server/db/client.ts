import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Db } from "./types";

const globalForDb = globalThis as unknown as { berberSql?: ReturnType<typeof postgres> };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL tanımlı değil. .env.local dosyasını oluşturun (bkz. .env.example).",
    );
  }
  // Supabase'in "transaction pooler" bağlantısı hazır sorguları (prepared
  // statements) desteklemediği için kapatılır.
  return postgres(url, { prepare: false, max: 5 });
}

// Geliştirme sırasında her kod değişikliğinde yeni bağlantı açılmasın.
const sql = globalForDb.berberSql ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.berberSql = sql;

export const db: Db = drizzle(sql, { schema });
