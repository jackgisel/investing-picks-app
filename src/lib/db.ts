import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __outpickPgPool: Pool | undefined;
}

// Reuse the pool across hot reloads in dev and across requests in prod.
export const pool: Pool =
  global.__outpickPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global.__outpickPgPool = pool;
}
