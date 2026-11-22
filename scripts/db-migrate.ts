/**
 * Göçleri (migrations) .env.local içindeki veritabanına uygular.
 * drizzle-kit'in "migrate" komutu bağlantı hatalarını bazen sessizce yutuyor;
 * bu betik her adımı ve olası hatayı Türkçe olarak yazar.
 *
 * Kullanım: npm run db:migrate
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** Hatayı, şifreyi göstermeden anlaşılır bir açıklamaya çevirir. */
function explain(error: unknown): string {
  const e = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e.code ?? e.cause?.code ?? "";
  const message = e.message ?? e.cause?.message ?? String(error);
  if (code === "28P01" || /password authentication failed/i.test(message))
    return "Şifre yanlış. .env.local içindeki şifreyi kontrol edin; [YOUR-PASSWORD] kalmamalı.";
  if (/tenant or user not found/i.test(message))
    return "Kullanıcı adı ya da proje kodu yanlış. Adresi Supabase → Connect ekranından yeniden kopyalayın.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    return "Sunucu adresi bulunamadı. Adres eksik kopyalanmış olabilir ya da internet bağlantınızı kontrol edin.";
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "CONNECT_TIMEOUT")
    return "Sunucuya bağlanılamadı. Session pooler adresini (port 5432) kullandığınızdan emin olun.";
  return `Beklenmeyen hata (${code || "kod yok"}): ${message}`;
}

async function main() {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) fail(".env.local dosyasında DATABASE_URL_DIRECT bulunamadı.");
  if (url.includes("BURAYA") || url.includes("[YOUR-PASSWORD]")) {
    fail(".env.local içindeki DATABASE_URL_DIRECT henüz doldurulmamış.");
  }

  let host: string;
  try {
    const parsed = new URL(url);
    host = `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    fail("DATABASE_URL_DIRECT geçerli bir adres değil. Tırnaklar içinde, tek satır olmalı.");
  }

  console.log(`→ Bağlanılıyor: ${host}`);
  const sql = postgres(url, { max: 1, connect_timeout: 15, fetch_types: false, onnotice: () => {} });

  try {
    await sql`select 1`;
    console.log("✓ Bağlantı kuruldu");

    console.log("→ Tablolar kuruluyor...");
    await migrate(drizzle(sql), { migrationsFolder: "src/server/db/migrations" });

    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`;
    const [rule] = await sql`
      select 1 from pg_constraint where conname = 'appointments_no_overlap'`;

    console.log(`✓ ${tables.length} tablo hazır: ${tables.map((t) => t.table_name).join(", ")}`);
    console.log(rule ? "✓ Çift randevu kuralı aktif" : "✗ Çift randevu kuralı bulunamadı");
    console.log("\nTamamlandı.\n");
  } catch (error) {
    await sql.end({ timeout: 1 }).catch(() => {});
    fail(explain(error));
  }
  await sql.end();
}

main();
