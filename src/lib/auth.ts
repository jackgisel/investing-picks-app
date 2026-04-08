import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { pool } from "@/lib/db";
import { runAppMigrations } from "@/lib/app-migrations";
import { sendDeleteAccountEmail } from "@/lib/email";

const authConfig = {
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,

  emailAndPassword: {
    enabled: true,
  },

  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendDeleteAccountEmail({
          to: user.email,
          name: user.name ?? null,
          confirmUrl: url,
        });
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(authConfig);

// Auto-migrate on first load. Runs both better-auth's own migrations and
// our app-owned tables (user_preferences, user_subscription).
let migrated = false;
let migrationPromise: Promise<void> | null = null;
export async function ensureMigrations() {
  if (migrated) return;
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    try {
      const { runMigrations } = await getMigrations(authConfig);
      await runMigrations();
      await runAppMigrations();
      migrated = true;
      console.log("Migrations applied");
    } catch (e) {
      console.error("Migration failed:", e);
      // Don't permanently lock — let the next request retry.
      migrationPromise = null;
      throw e;
    }
  })();
  return migrationPromise;
}
