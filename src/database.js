import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createDatabase(databasePath) {
  const resolvedPath = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      customer_first_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      whatsapp_message_id TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_message_jobs_ready
      ON message_jobs(status, next_attempt_at);
  `);

  // Se o processo caiu durante um envio, a tarefa volta para a fila ao reiniciar.
  db.prepare(`
    UPDATE message_jobs
    SET status = 'retry', next_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE status = 'processing'
  `).run();

  return db;
}

export function enqueueOrder(db, job) {
  const result = db.prepare(`
    INSERT INTO message_jobs (order_id, phone, customer_first_name, product_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(order_id) DO NOTHING
  `).run(job.orderId, job.phone, job.customerFirstName, job.productName);

  return result.changes === 1;
}

export function claimNextJob(db, maxAttempts) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const job = db.prepare(`
      SELECT * FROM message_jobs
      WHERE status IN ('pending', 'retry')
        AND attempts < ?
        AND next_attempt_at <= CURRENT_TIMESTAMP
      ORDER BY id ASC
      LIMIT 1
    `).get(maxAttempts);

    if (!job) {
      db.exec('COMMIT');
      return null;
    }

    db.prepare(`
      UPDATE message_jobs
      SET status = 'processing', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(job.id);

    db.exec('COMMIT');
    return { ...job, attempts: job.attempts + 1 };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function markSent(db, id, messageId) {
  db.prepare(`
    UPDATE message_jobs
    SET status = 'sent', whatsapp_message_id = ?, last_error = NULL,
        sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(messageId || null, id);
}

export function markFailed(db, id, error, attempts, maxAttempts) {
  const permanentlyFailed = attempts >= maxAttempts;
  const delaysSeconds = [30, 120, 600, 3600, 14400];
  const delay = delaysSeconds[Math.min(attempts - 1, delaysSeconds.length - 1)];

  db.prepare(`
    UPDATE message_jobs
    SET status = ?, last_error = ?,
        next_attempt_at = datetime('now', ?), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    permanentlyFailed ? 'failed' : 'retry',
    String(error).slice(0, 1000),
    `+${delay} seconds`,
    id,
  );
}

export function queueStats(db) {
  return db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM message_jobs
    GROUP BY status
  `).all().reduce((result, row) => {
    result[row.status] = Number(row.count);
    return result;
  }, {});
}
