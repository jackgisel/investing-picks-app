import { pool } from "@/lib/db";
import type { ProductUpdate, ProductUpdateStatus } from "@/lib/product-updates";

type Row = {
  id: string;
  subject: string;
  body_md: string;
  status: ProductUpdateStatus;
  sent_at: Date | null;
  recipients: number | null;
  created_at: Date;
  updated_at: Date;
};

function toUpdate(r: Row): ProductUpdate {
  return {
    id: String(r.id),
    subject: r.subject,
    bodyMd: r.body_md,
    status: r.status,
    sentAt: r.sent_at ? r.sent_at.toISOString() : null,
    recipients: r.recipients,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const COLUMNS = `id, subject, body_md, status, sent_at, recipients,
  created_at, updated_at`;

export async function listProductUpdates(): Promise<ProductUpdate[]> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM product_update ORDER BY created_at DESC LIMIT 100`,
  );
  return rows.map(toUpdate);
}

export async function getProductUpdate(
  id: string,
): Promise<ProductUpdate | null> {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM product_update WHERE id = $1`,
    [id],
  );
  return rows[0] ? toUpdate(rows[0]) : null;
}

export async function createProductUpdate(
  subject: string,
): Promise<ProductUpdate> {
  const { rows } = await pool.query<Row>(
    `INSERT INTO product_update (subject) VALUES ($1) RETURNING ${COLUMNS}`,
    [subject],
  );
  return toUpdate(rows[0]);
}

/** Edits. A sent update is frozen — its text is what landed in inboxes. */
export async function updateProductUpdate(
  id: string,
  fields: { subject?: string; bodyMd?: string },
): Promise<ProductUpdate | null> {
  const sets: string[] = [];
  const values: unknown[] = [id];
  if (fields.subject !== undefined) {
    values.push(fields.subject);
    sets.push(`subject = $${values.length}`);
  }
  if (fields.bodyMd !== undefined) {
    values.push(fields.bodyMd);
    sets.push(`body_md = $${values.length}`);
  }
  if (sets.length === 0) return getProductUpdate(id);

  const { rows } = await pool.query<Row>(
    `UPDATE product_update
        SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $1 AND status = 'draft'
      RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0] ? toUpdate(rows[0]) : null;
}

export async function deleteProductUpdate(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM product_update WHERE id = $1 AND status = 'draft'`,
    [id],
  );
  return rowCount === 1;
}

/**
 * Claim the send and mark it sent, or return null if someone already did.
 *
 * The same shape as `claimForPublish`: status and `sent_at` move in one
 * conditional UPDATE, so two admins pressing Send, a double-click, or a retried
 * request produce exactly one winner. Claiming before dispatch is deliberate —
 * a crash mid-send leaves an update that reached some of the list, which is
 * recoverable, rather than one that can be mailed again from scratch.
 */
export async function claimProductUpdateSend(
  id: string,
  recipients: number,
): Promise<ProductUpdate | null> {
  const { rows } = await pool.query<Row>(
    `UPDATE product_update
        SET status = 'sent', sent_at = NOW(), recipients = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'draft' AND sent_at IS NULL
      RETURNING ${COLUMNS}`,
    [id, recipients],
  );
  return rows[0] ? toUpdate(rows[0]) : null;
}
