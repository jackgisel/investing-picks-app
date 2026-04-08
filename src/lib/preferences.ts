import { pool } from "@/lib/db";

export type NotificationPrefs = {
  newPicks: boolean;
  weeklySummary: boolean;
  performanceAlerts: boolean;
  productUpdates: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  newPicks: true,
  weeklySummary: true,
  performanceAlerts: true,
  productUpdates: false,
};

type Row = {
  new_picks: boolean;
  weekly_summary: boolean;
  performance_alerts: boolean;
  product_updates: boolean;
};

function rowToPrefs(row: Row): NotificationPrefs {
  return {
    newPicks: row.new_picks,
    weeklySummary: row.weekly_summary,
    performanceAlerts: row.performance_alerts,
    productUpdates: row.product_updates,
  };
}

/** Returns the user's notification preferences, or DEFAULT_PREFS if no row exists. */
export async function getPreferences(userId: string): Promise<NotificationPrefs> {
  const result = await pool.query<Row>(
    `SELECT new_picks, weekly_summary, performance_alerts, product_updates
       FROM user_preferences
      WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return { ...DEFAULT_PREFS };
  return rowToPrefs(result.rows[0]);
}

/** Upsert the user's notification preferences. */
export async function setPreferences(
  userId: string,
  prefs: NotificationPrefs
): Promise<NotificationPrefs> {
  const result = await pool.query<Row>(
    `INSERT INTO user_preferences
        (user_id, new_picks, weekly_summary, performance_alerts, product_updates, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        new_picks = EXCLUDED.new_picks,
        weekly_summary = EXCLUDED.weekly_summary,
        performance_alerts = EXCLUDED.performance_alerts,
        product_updates = EXCLUDED.product_updates,
        updated_at = NOW()
      RETURNING new_picks, weekly_summary, performance_alerts, product_updates`,
    [
      userId,
      prefs.newPicks,
      prefs.weeklySummary,
      prefs.performanceAlerts,
      prefs.productUpdates,
    ]
  );
  return rowToPrefs(result.rows[0]);
}

/**
 * Returns user IDs + emails for everyone who has opted in to a given prefs flag.
 * Users with no preference row use DEFAULT_PREFS, so a LEFT JOIN with COALESCE
 * ensures defaults are honored.
 */
export async function getOptedInRecipients(
  flag: keyof NotificationPrefs
): Promise<{ id: string; email: string; name: string | null }[]> {
  const columnMap: Record<keyof NotificationPrefs, string> = {
    newPicks: "new_picks",
    weeklySummary: "weekly_summary",
    performanceAlerts: "performance_alerts",
    productUpdates: "product_updates",
  };
  const defaultMap: Record<keyof NotificationPrefs, boolean> = {
    newPicks: DEFAULT_PREFS.newPicks,
    weeklySummary: DEFAULT_PREFS.weeklySummary,
    performanceAlerts: DEFAULT_PREFS.performanceAlerts,
    productUpdates: DEFAULT_PREFS.productUpdates,
  };
  const column = columnMap[flag];
  const defaultValue = defaultMap[flag];

  const result = await pool.query<{
    id: string;
    email: string;
    name: string | null;
  }>(
    `SELECT u.id, u.email, u.name
       FROM "user" u
       LEFT JOIN user_preferences p ON p.user_id = u.id
      WHERE COALESCE(p.${column}, $1) = TRUE
        AND u.email IS NOT NULL`,
    [defaultValue]
  );
  return result.rows;
}
