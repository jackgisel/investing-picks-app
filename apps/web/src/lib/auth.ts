import { betterAuth, type BetterAuthOptions } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { pool } from "@/lib/db";
import { runAppMigrations } from "@/lib/app-migrations";
import { sendDeleteAccountEmail, sendMagicLinkEmail } from "@/lib/email";
import { grantComplimentaryMembership } from "@/lib/complimentary-grant";
import { flushPendingMembershipInvites } from "@/lib/membership-invites";
import { cancelStripeSubscriptionForDeletedUser } from "@/lib/subscription";

/**
 * There is no password on this account model — sign-in is a magic link
 * emailed on request (see the `magicLink` plugin below). Verifying the link
 * IS signing in, so `user.emailVerified` is guaranteed true for every
 * session the moment it exists; nothing downstream needs a separate
 * verification gate. This function stays for the few call sites (billing
 * checkout, admin promotion) that still check `emailVerified` defensively —
 * it always resolves true in practice now, which is the correct outcome,
 * not a bug.
 */
export function requireEmailVerification(): boolean {
  const explicit = process.env.REQUIRE_EMAIL_VERIFICATION;
  if (explicit) return explicit.toLowerCase() === "true";
  return Boolean(process.env.RESEND_API_KEY);
}

const authConfig = {
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Never let a mail failure break sign-in. With no provider
        // configured this no-ops with a warning, which is what makes local
        // and pre-launch testing possible without an email account.
        try {
          await sendMagicLinkEmail({ to: email, signInUrl: url });
        } catch (e) {
          console.error("Failed to send magic link email:", e);
        }
      },
    }),
  ],

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
      // Runs right before the user row is actually removed — on both the
      // immediate-delete path and the confirmation-link callback. Deleting
      // an account must not leave Stripe billing an account that no longer
      // exists (see cancelStripeSubscriptionForDeletedUser).
      beforeDelete: async (user) => {
        await cancelStripeSubscriptionForDeletedUser(user.id);
      },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // An admin invite becomes a live membership at sign-in, before the
        // magic-link redirect lands, so the invitee's first page is already
        // the member experience. Awaited for that reason, but never allowed
        // to fail sign-in: /subscribe retries the same grant idempotently.
        after: async (session) => {
          try {
            const { rows } = await pool.query<{
              email: string;
              name: string | null;
              emailVerified: boolean;
            }>(
              `SELECT email, name, "emailVerified" FROM "user" WHERE id = $1`,
              [session.userId],
            );
            const user = rows[0];
            if (!user) return;
            const result = await grantComplimentaryMembership({
              id: session.userId,
              email: user.email,
              name: user.name,
              emailVerified: user.emailVerified === true,
            });
            if (result === "granted") {
              console.log(`[membership-invite] granted ${user.email}`);
            }
          } catch (e) {
            console.error("Complimentary membership grant failed:", e);
          }
        },
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
      // Do not await: a Resend outage must not fail the request that triggered
      // migrations. Failures leave sent_at NULL so the next boot retries.
      void flushPendingMembershipInvites().catch((error) => {
        console.error("Failed to send pending membership invites:", error);
      });
    } catch (e) {
      console.error("Migration failed:", e);
      // Don't permanently lock — let the next request retry.
      migrationPromise = null;
      throw e;
    }
  })();
  return migrationPromise;
}
