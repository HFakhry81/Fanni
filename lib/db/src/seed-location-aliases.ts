/**
 * Seed script — Nominatim variant spellings for known locations.
 *
 * These aliases cover uncommon suburb/city names returned by the Nominatim
 * geocoding API that do not match the canonical nameEn, nameAr, or slug
 * stored in the locations table. Adding an alias here ensures the
 * locationNormalizer alias map picks it up on the next cache warm.
 *
 * Usage:
 *   pnpm --filter @workspace/db tsx src/seed-location-aliases.ts
 *
 * Run this script whenever new Nominatim mismatches are discovered in
 * production logs (search for "Normalized location to slug" with unexpected
 * raw values, or orders that failed to match a location).
 *
 * Safe to re-run: uses INSERT … ON CONFLICT DO NOTHING.
 */

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

type AliasEntry = {
  locationId: string;
  alias: string;
  note: string;
};

const ALIASES: AliasEntry[] = [
  // ── Alexandria ────────────────────────────────────────────────────────────

  // Sidi Bishr — Nominatim alternate romanisations
  { locationId: "alexandria__sidi_bishr", alias: "sidi bisher", note: "Nominatim alternate romanisation" },
  { locationId: "alexandria__sidi_bishr", alias: "sidy bishr", note: "Nominatim alternate romanisation" },
  { locationId: "alexandria__sidi_bishr", alias: "sidi bishr west", note: "Nominatim suburb variant" },
  { locationId: "alexandria__sidi_bishr", alias: "sidi bishr east", note: "Nominatim suburb variant" },
  { locationId: "alexandria__sidi_bishr", alias: "sidi bishr al qibli", note: "Nominatim suburb variant" },
  { locationId: "alexandria__sidi_bishr", alias: "سيدي بشر", note: "Arabic Nominatim variant" },

  // Ibrahimiyya (Alexandria) — nameEn is 'Al Ibrahimeyah'; Nominatim returns several spellings
  { locationId: "alexandria__al_ibrahimeyah", alias: "ibrahimiyya", note: "Common Nominatim suburb spelling" },
  { locationId: "alexandria__al_ibrahimeyah", alias: "ibrahimiya", note: "Nominatim variant" },
  { locationId: "alexandria__al_ibrahimeyah", alias: "al ibrahimiyya", note: "Nominatim variant" },
  { locationId: "alexandria__al_ibrahimeyah", alias: "el ibrahimeyya", note: "Nominatim variant" },
  { locationId: "alexandria__al_ibrahimeyah", alias: "el ibrahimiya", note: "Nominatim variant" },
  { locationId: "alexandria__al_ibrahimeyah", alias: "ibrahimeya", note: "Nominatim variant" },
  { locationId: "alexandria__al_ibrahimeyah", alias: "ibrahimiyah", note: "Nominatim variant" },

  // Laurent — historical European-quarter name; Nominatim may return it for the Glim / Boulkly coastal strip
  { locationId: "alexandria__glim", alias: "laurent", note: "Historical European neighbourhood name (Nominatim suburb)" },
  { locationId: "alexandria__glim", alias: "san laurent", note: "Nominatim suburb variant of Laurent quarter" },
  { locationId: "alexandria__glim", alias: "saint laurent", note: "Nominatim suburb variant of Laurent quarter" },

  // Glim variants
  { locationId: "alexandria__glim", alias: "gleem", note: "Nominatim alternate romanisation" },
  { locationId: "alexandria__glim", alias: "jalim", note: "Nominatim transliteration variant" },

  // Boulkly / Bulkeley
  { locationId: "alexandria__boulkly", alias: "bulkeley", note: "Historical English spelling used by Nominatim" },
  { locationId: "alexandria__boulkly", alias: "bolkly", note: "Nominatim variant" },
  { locationId: "alexandria__boulkly", alias: "bulkaly", note: "Nominatim transliteration" },
  { locationId: "alexandria__boulkly", alias: "boulkli", note: "Nominatim variant" },

  // Fleming
  { locationId: "alexandria__fleming", alias: "flemming", note: "Nominatim double-m variant" },
  { locationId: "alexandria__fleming", alias: "flemeng", note: "Nominatim alternate spelling" },

  // Smouha
  { locationId: "alexandria__smouha", alias: "smoha", note: "Nominatim romanisation variant" },
  { locationId: "alexandria__smouha", alias: "samuha", note: "Nominatim transliteration" },

  // Stanley
  { locationId: "alexandria__stanley", alias: "stanly", note: "Nominatim variant" },

  // Montaza
  { locationId: "alexandria__el_montaza", alias: "montaza", note: "Nominatim without article" },
  { locationId: "alexandria__el_montaza", alias: "al montazah", note: "Nominatim variant" },
  { locationId: "alexandria__el_montaza", alias: "el montazah", note: "Nominatim variant" },

  // Mandara
  { locationId: "alexandria__al_mandara", alias: "mandara", note: "Nominatim without article" },
  { locationId: "alexandria__al_mandara", alias: "el mandara", note: "Nominatim variant" },

  // Mamurah
  { locationId: "alexandria__al_mamurah", alias: "mamurah", note: "Nominatim without article" },
  { locationId: "alexandria__al_mamurah", alias: "el mamurah", note: "Nominatim variant" },
  { locationId: "alexandria__al_mamurah", alias: "al mamura", note: "Nominatim variant" },

  // Shatby
  { locationId: "alexandria__elshatby", alias: "shatby", note: "Nominatim without article" },
  { locationId: "alexandria__elshatby", alias: "el shatby", note: "Nominatim with article and space" },
  { locationId: "alexandria__elshatby", alias: "al shatbi", note: "Nominatim variant" },

  // Attarin
  { locationId: "alexandria__alattarin", alias: "attarin", note: "Nominatim without article" },
  { locationId: "alexandria__alattarin", alias: "al attarin", note: "Nominatim with space" },

  // Hadra
  { locationId: "alexandria__alhadra", alias: "hadra", note: "Nominatim without article" },
  { locationId: "alexandria__alhadra", alias: "al hadra", note: "Nominatim with space" },
  { locationId: "alexandria__alhadra", alias: "el hadra", note: "Nominatim variant" },

  // ── Cairo ─────────────────────────────────────────────────────────────────
  // (add Cairo-specific Nominatim variants here as they are discovered)

  // ── Giza ──────────────────────────────────────────────────────────────────
  // (add Giza-specific Nominatim variants here as they are discovered)
];

try {
  await client.query("BEGIN");
  let inserted = 0;
  let skipped = 0;

  for (const entry of ALIASES) {
    const normalizedAlias = entry.alias.toLowerCase().trim();
    const result = await client.query(
      `INSERT INTO location_aliases (location_id, alias, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (location_id, alias) DO NOTHING`,
      [entry.locationId, normalizedAlias, entry.note],
    );
    if (result.rowCount && result.rowCount > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  await client.query("COMMIT");
  console.log(`Location aliases seeded: ${inserted} inserted, ${skipped} already existed.`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Seed failed:", err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
