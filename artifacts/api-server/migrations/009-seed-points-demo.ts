/**
 * Migration + Demo Seed: Fanni Points System
 *
 * Run with:
 *   pnpm --filter @workspace/api-server exec tsx migrations/009-seed-points-demo.ts
 *
 * Idempotent — safe to run multiple times.
 * Seeds demo wallet data for all existing technician accounts.
 */

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

console.log("🔄  Running Fanni Points demo seed…\n");

// ── Step 1: ensure migration is applied ───────────────────────────────────────
const { rows: migCheck } = await client.query<{ exists: boolean }>(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallets'
  ) AS exists
`);

if (!migCheck[0]?.exists) {
  console.error("❌  Tables not found — run the DB migration first:");
  console.error("     pnpm --filter @workspace/db run migrate");
  client.release();
  await pool.end();
  process.exit(1);
}

// ── Step 2: ensure default packages exist ─────────────────────────────────────
const { rows: pkgRows } = await client.query(`SELECT id FROM point_packages LIMIT 1`);
if (pkgRows.length === 0) {
  await client.query(`
    INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, sort_order)
    VALUES
      ('Starter 100', 'باقة 100 جنيه', 120, 100.00, NULL, 1),
      ('Plus 250',    'باقة 250 جنيه', 300, 250.00, NULL, 2),
      ('Pro 500',     'باقة 500 جنيه', 600, 500.00, NULL, 3),
      ('Max 750',     'باقة 750 جنيه', 900, 750.00, NULL, 4),
      ('Elite 1000',  'باقة 1000 جنيه', 1200, 1000.00, NULL, 5)
    ON CONFLICT DO NOTHING
  `);
  console.log("✓  Seeded 3 default point packages");
} else {
  console.log("ℹ️  Point packages already exist — skipping");
}

// ── Step 3: ensure default unlock cost exists ─────────────────────────────────
const { rows: costRows } = await client.query(`SELECT id FROM unlock_costs WHERE specialty_slug IS NULL AND category_slug IS NULL LIMIT 1`);
if (costRows.length === 0) {
  await client.query(`
    INSERT INTO unlock_costs (specialty_slug, category_slug, points_cost, label)
    VALUES (NULL, NULL, 20, 'Default unlock cost')
    ON CONFLICT DO NOTHING
  `);
  console.log("✓  Seeded default unlock cost (20 pts)");
} else {
  console.log("ℹ️  Default unlock cost already exists — skipping");
}

// ── Step 4: seed demo wallets for every technician ────────────────────────────
const { rows: techRows } = await client.query<{ id: string; first_name: string | null; mobile: string }>(
  `SELECT id, first_name, mobile FROM users WHERE role = 'technician' LIMIT 20`
);

if (techRows.length === 0) {
  console.log("ℹ️  No technician accounts found — demo wallets skipped");
} else {
  for (const tech of techRows) {
    const name = tech.first_name ?? tech.mobile;

    // Get or create wallet
    const { rows: walletRows } = await client.query<{ id: string; points_balance: number }>(
      `SELECT id, points_balance FROM wallets WHERE user_id = $1`,
      [tech.id]
    );

    let walletId: string;
    let currentBalance: number;

    if (walletRows[0]) {
      walletId = walletRows[0].id;
      currentBalance = walletRows[0].points_balance;
    } else {
      const { rows: created } = await client.query<{ id: string }>(
        `INSERT INTO wallets (user_id, points_balance) VALUES ($1, 0) RETURNING id`,
        [tech.id]
      );
      walletId = created[0]!.id;
      currentBalance = 0;
    }

    // Check if demo seed already applied (look for welcome_bonus transaction)
    const { rows: alreadySeeded } = await client.query(
      `SELECT id FROM wallet_transactions WHERE wallet_id = $1 AND type = 'welcome_bonus' LIMIT 1`,
      [walletId]
    );

    if (alreadySeeded.length > 0) {
      console.log(`ℹ️  ${name} (${tech.mobile}) — wallet already seeded (${currentBalance} pts)`);
      continue;
    }

    // Seed: welcome bonus 60 pts
    await client.query(`
      INSERT INTO wallet_transactions (wallet_id, points_amount, type, description)
      VALUES ($1, 60, 'welcome_bonus', 'مكافأة ترحيبية — Welcome bonus')
    `, [walletId]);

    // Seed: demo package purchase 120 pts for 100 EGP
    await client.query(`
      INSERT INTO wallet_transactions (wallet_id, points_amount, type, cash_amount_paid, description)
      VALUES ($1, 120, 'package_purchase', 100.00, 'باقة 100 جنيه')
    `, [walletId]);

    // Update balance (60 bonus + 120 purchase)
    const newBalance = currentBalance + 180;
    await client.query(
      `UPDATE wallets SET points_balance = $1, promotional_balance = promotional_balance + 60, purchased_balance = purchased_balance + 120, updated_at = NOW() WHERE id = $2`,
      [newBalance, walletId]
    );

    console.log(`✓  ${name} (${tech.mobile}) — wallet seeded: ${newBalance} pts`);
  }
}

client.release();
await pool.end();

console.log("\n✅  Fanni Points demo seed complete.");
