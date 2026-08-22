import type { Request } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";

export function clientIp(req: Request): string {
  return String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown");
}

/** Sliding window counter backed by `rate_limits`. Returns false when over the cap. */
export async function checkRateLimit(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  const windowSecs = windowMs / 1000;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key]);
    await client.query(
      `DELETE FROM rate_limits WHERE key = $1 AND hit_at < NOW() - make_interval(secs => $2)`,
      [key, windowSecs],
    );
    const { rows } = await client.query<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM rate_limits WHERE key = $1`,
      [key],
    );
    const count = rows[0]?.cnt ?? 0;
    if (count >= maxRequests) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(`INSERT INTO rate_limits (key) VALUES ($1)`, [key]);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    logger.warn({ err, key }, "rate limit check failed");
    throw err;
  } finally {
    client.release();
  }
}
