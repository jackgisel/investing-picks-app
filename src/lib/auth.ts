import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const authConfig = {
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,

  emailAndPassword: {
    enabled: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(authConfig);

// Auto-migrate on first load
let migrated = false;
export async function ensureMigrations() {
  if (migrated) return;
  migrated = true;
  try {
    const { runMigrations } = await getMigrations(authConfig);
    await runMigrations();
    console.log("Auth migrations applied");
  } catch (e) {
    console.error("Auth migration failed:", e);
  }
}
