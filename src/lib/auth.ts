import { betterAuth } from "better-auth";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
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

  user: {
    additionalFields: {
      subscriptionStatus: {
        type: "string",
        defaultValue: "inactive",
      },
      paddleCustomerId: {
        type: "string",
        defaultValue: null,
        nullable: true,
      },
      paddleSubscriptionId: {
        type: "string",
        defaultValue: null,
        nullable: true,
      },
    },
  },
});
