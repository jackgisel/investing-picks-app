import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { pool } from "@/lib/db";
import { runAppMigrations } from "@/lib/app-migrations";
import { sendDeleteAccountEmail, sendVerifyEmail } from "@/lib/email";

/**
 * Whether an unverified account is blocked from signing in.
 *
 * Defaults to "on when we can actually send mail", so verification switches
 * itself on the moment RESEND_API_KEY is configured rather than relying on
 * someone remembering to flip it before launch. Set
 * REQUIRE_EMAIL_VERIFICATION explicitly to override in either direction.
 *
 * Note this is NOT what protects the admin account — see lib/admin.ts. Admin
 * promotion requires either a verified address or the one-time bootstrap
 * token, so turning this off does not make the ops surface claimable.
 */
function requireEmailVerification(): boolean {
  const explicit = process.env.REQUIRE_EMAIL_VERIFICATION;
  if (explicit) return explicit.toLowerCase() === "true";
  return Boolean(process.env.RESEND_API_KEY);
}

const authConfig = {
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: requireEmailVerification(),
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Never let a mail failure break sign-up. With no provider configured
      // this no-ops with a warning, which is what makes local and pre-launch
      // testing possible without an email account.
      try {
        await sendVerifyEmail({
          to: user.email,
          name: user.name ?? null,
          verifyUrl: url,
        });
      } catch (e) {
        console.error("Failed to send verification email:", e);
      }
    },
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
