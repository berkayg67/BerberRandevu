import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Hem gerçek bağlantı (postgres.js) hem testlerdeki bellek içi PostgreSQL
 * (PGlite) bu tipe uyar. Servisler veritabanını parametre olarak alır.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
