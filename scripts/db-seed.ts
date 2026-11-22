/**
 * Demo dükkânı (berber-demo) .env.local içindeki veritabanına ekler.
 * Zaten varsa dokunmaz.
 *
 * Kullanım: npm run db:seed
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEMO_SHOP, seedDemoShop } from "../src/server/db/demo-shop";
import * as schema from "../src/server/db/schema";
import type { Db } from "../src/server/db/types";

config({ path: ".env.local", quiet: true });

async function main() {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url || url.includes("BURAYA") || url.includes("[YOUR-PASSWORD]")) {
    console.error("\n✗ .env.local içindeki DATABASE_URL_DIRECT doldurulmamış.\n");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, connect_timeout: 15, fetch_types: false, onnotice: () => {} });
  try {
    const db = drizzle(sql, { schema }) as unknown as Db;
    const result = await seedDemoShop(db);
    console.log(
      result.created
        ? `✓ Demo dükkân eklendi: ${DEMO_SHOP.name} (${DEMO_SHOP.slug})`
        : `• Demo dükkân zaten var: ${DEMO_SHOP.name} (${DEMO_SHOP.slug}). Değişiklik yapılmadı.`,
    );
    console.log("\nKontrol için: npm run dev, sonra tarayıcıda http://localhost:3000/api/shops/berber-demo\n");
  } catch (error) {
    const e = error as { message?: string; cause?: { message?: string } };
    const message = e.cause?.message ?? e.message ?? String(error);
    console.error(
      /relation .* does not exist/i.test(message)
        ? "\n✗ Tablolar bulunamadı. Önce npm run db:migrate çalıştırın.\n"
        : `\n✗ Eklenemedi: ${message}\n`,
    );
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main();
