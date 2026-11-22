import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Gizli bağlantı bilgileri .env.local dosyasından okunur (Git'e gitmez).
config({ path: ".env.local", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dbCredentials: {
    // Tablo kurulumu için doğrudan oturum bağlantısı (port 5432).
    url: process.env.DATABASE_URL_DIRECT ?? "",
  },
  strict: true,
  verbose: true,
});
