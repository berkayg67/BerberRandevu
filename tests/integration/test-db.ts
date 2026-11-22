import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * Testler için bellek içinde çalışan gerçek bir PostgreSQL açar ve
 * projenin göçlerini (migrations) uygular. Supabase gerekmez.
 */
export async function createTestDb() {
  const client = await PGlite.create({ extensions: { btree_gist } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "src/server/db/migrations" });
  return { db: db as unknown as Db, client };
}

/** İki ustalı, Pazar kapalı, öğle arası olan örnek dükkân. */
export async function seedShop(db: Db) {
  const [shop] = await db
    .insert(schema.shops)
    .values({
      slug: "test-berber",
      name: "Test Berber",
      district: "Üsküdar",
      address: "Test Mah. No:1",
      phone: "0532 000 00 00",
      notifyPhone: "5320000000",
      reviewUrl: "https://g.page/r/TEST/review",
      slotMinutes: 15,
      bufferMinutes: 5,
      minNoticeMinutes: 30,
      bookAheadDays: 14,
      breakStart: "13:00",
      breakEnd: "14:00",
    })
    .returning();

  await db.insert(schema.workingHours).values(
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      shopId: shop.id,
      weekday,
      opens: "09:00",
      closes: "21:00",
    })),
  );

  const [murat, emre] = await db
    .insert(schema.staff)
    .values([
      { shopId: shop.id, name: "Murat", sort: 0 },
      { shopId: shop.id, name: "Emre", sort: 1 },
    ])
    .returning();

  const [haircut] = await db
    .insert(schema.services)
    .values([
      { shopId: shop.id, name: "Saç kesimi", durationMinutes: 30, priceKurus: 50000 },
      { shopId: shop.id, name: "Sakal tıraşı", durationMinutes: 20, priceKurus: 25000 },
    ])
    .returning();

  return { shop, murat, emre, haircut };
}
