import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const requireFromWeb = createRequire(resolve(repoRoot, "apps/web/package.json"));
const { Pool } = requireFromWeb("pg");
const cryptoModule = requireFromWeb.resolve("better-auth/crypto");
const { hashPassword, verifyPassword } = await import(
  pathToFileURL(cryptoModule).href
);

const databaseUrl = process.env.LOCAL_WEB_DATABASE_URL;
const email = process.env.LOCAL_TEST_EMAIL?.trim().toLowerCase();
const password = process.env.LOCAL_TEST_PASSWORD;

if (!databaseUrl) throw new Error("LOCAL_WEB_DATABASE_URL is required");
if (!email) throw new Error("LOCAL_TEST_EMAIL is required");
if (!password || password.length < 8) {
  throw new Error("LOCAL_TEST_PASSWORD must be at least 8 characters");
}

const userId = "local-test-user";
const accountId = "local-test-account";
const passwordHash = await hashPassword(password);
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(`
    TRUNCATE TABLE
      post_comment,
      user_preferences,
      user_subscription,
      market_note_subscriber,
      session,
      account,
      verification,
      "user"
    RESTART IDENTITY CASCADE
  `);

  await client.query(
    `INSERT INTO "user"
       (id, name, email, "emailVerified", image, "createdAt", "updatedAt", is_admin, display_name)
     VALUES ($1, $2, $3, TRUE, NULL, NOW(), NOW(), TRUE, $2)`,
    [userId, "Local Tester", email],
  );

  await client.query(
    `INSERT INTO account
       (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
    [accountId, userId, passwordHash],
  );

  await client.query(
    `INSERT INTO user_preferences
       (user_id, new_picks, weekly_summary, performance_alerts, product_updates)
     VALUES ($1, TRUE, TRUE, TRUE, FALSE)`,
    [userId],
  );

  await client.query(
    `INSERT INTO user_subscription
       (user_id, status, current_period_end, updated_at)
     VALUES ($1, 'active', NOW() + INTERVAL '10 years', NOW())`,
    [userId],
  );

  await client.query("COMMIT");

  const stored = await client.query(
    `SELECT password FROM account WHERE id = $1`,
    [accountId],
  );
  const valid = await verifyPassword({
    hash: stored.rows[0]?.password ?? "",
    password,
  });
  if (!valid) throw new Error("seeded password failed BetterAuth verification");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
