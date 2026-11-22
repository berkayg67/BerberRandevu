/**
 * Yönetici hesabı oluşturur ya da şifresini yeniler. Şifreyi kendisi üretir
 * ve yalnızca bir kez ekrana yazar.
 *
 * Kullanım: npm run admin:create -- ornek@mail.com "Ad Soyad"
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generatePassword } from "../src/server/auth/password";
import { upsertAdmin } from "../src/server/auth/service";
import * as schema from "../src/server/db/schema";
import type { Db } from "../src/server/db/types";

config({ path: ".env.local", quiet: true });

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
    console.error('\nKullanım: npm run admin:create -- ornek@mail.com "Ad Soyad"\n');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url || url.includes("BURAYA")) {
    console.error("\n✗ .env.local içindeki DATABASE_URL_DIRECT doldurulmamış.\n");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, connect_timeout: 15, fetch_types: false, onnotice: () => {} });
  try {
    const password = generatePassword();
    const result = await upsertAdmin(drizzle(sql, { schema }) as unknown as Db, { email, name, password });
    console.log(result.created ? "\n✓ Yönetici hesabı oluşturuldu." : "\n✓ Yönetici şifresi yenilendi; açık oturumlar kapatıldı.");
    console.log(`\n  E-posta: ${email.toLowerCase()}`);
    console.log(`  Şifre:   ${password}`);
    console.log("\n  Bu şifre bir daha gösterilmeyecek. Şimdi bir şifre yöneticisine kaydedin.");
    console.log("  Giriş: http://localhost:3000/admin\n");
  } catch (error) {
    const e = error as { message?: string; cause?: { message?: string } };
    const message = e.cause?.message ?? e.message ?? String(error);
    console.error(
      /relation .* does not exist/i.test(message)
        ? "\n✗ Tablolar eksik. Önce npm run db:migrate çalıştırın.\n"
        : `\n✗ ${message}\n`,
    );
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main();
