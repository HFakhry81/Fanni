/**
 * Verification script: tests that pre-v2 (old single-word) area slugs and common
 * legacy location names resolve correctly to canonical new `{gov}__{city}` slugs
 * after the location cache is warmed from the reseeded DB.
 *
 * Run: pnpm tsx artifacts/api-server/migrations/test-normalizer-compat.ts
 * Expects 0 failures.
 */

import pg from "pg";

const { Pool } = pg;

interface LocationRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  parentId: string | null;
  type: string;
}

function stripNoise(s: string): string {
  return s
    .replace(/\s+(district|governorate|area|region|quarter|neighborhood|hay|حي|منطقة|محافظة|مدينة|مركز)\s*$/i, "")
    .replace(/^(مدينة|حي|مركز)\s+/u, "")
    .replace(/^(al-|el-|al |el )/i, "")
    .trim();
}

function buildAliasMap(cache: LocationRow[]): Record<string, string> {
  const map: Record<string, string> = {};

  const setKeys = (loc: LocationRow) => {
    const en = loc.nameEn.toLowerCase().trim();
    const ar = loc.nameAr.trim();
    const slug = loc.slug.toLowerCase();
    map[en] = loc.slug;
    map[ar] = loc.slug;
    map[slug] = loc.slug;
    map[slug.replace(/[_]/g, " ")] = loc.slug;
    map[stripNoise(en)] = loc.slug;
    if (loc.type === "area" && loc.slug.includes("__")) {
      const cityPart = loc.slug.split("__")[1];
      const cityPartSpaced = cityPart.replace(/_/g, " ");
      map[cityPart] = loc.slug;
      map[cityPartSpaced] = loc.slug;
      map[stripNoise(cityPartSpaced)] = loc.slug;
    }
  };

  for (const loc of cache) {
    if (loc.type === "area") setKeys(loc);
  }
  for (const loc of cache) {
    if (loc.type === "governorate") setKeys(loc);
  }

  return map;
}

function scoreMatch(raw: string, loc: LocationRow): number {
  const rawLower = raw.toLowerCase().trim().replace(/[_\-]/g, " ");
  const slugLower = loc.slug.toLowerCase().replace(/[_\-]/g, " ");
  const nameEnLower = loc.nameEn.toLowerCase().trim();
  const nameArTrimmed = loc.nameAr.trim();
  if (rawLower === slugLower) return 100;
  if (rawLower === nameEnLower) return 95;
  if (rawLower === nameArTrimmed) return 95;
  const rawNorm = stripNoise(rawLower);
  if (rawNorm === stripNoise(slugLower)) return 85;
  if (rawNorm === stripNoise(nameEnLower)) return 80;
  if (rawNorm === stripNoise(nameArTrimmed.toLowerCase())) return 80;
  if (nameEnLower.includes(rawLower) || rawLower.includes(nameEnLower)) return 60;
  if (nameArTrimmed.includes(rawLower) || rawLower.includes(nameArTrimmed)) return 55;
  const slugCityPart = loc.slug.includes("__") ? loc.slug.split("__")[1].replace(/_/g, " ") : null;
  if (slugCityPart) {
    const rawNormNSep = rawLower.replace(/__/g, " ");
    if (rawNormNSep === slugCityPart) return 70;
    if (stripNoise(rawNormNSep) === stripNoise(slugCityPart)) return 65;
  }
  return 0;
}

function resolve(raw: string, cache: LocationRow[], aliasMap: Record<string, string>): string {
  if (!cache.length) return raw.toLowerCase();
  const rawKey = raw.toLowerCase().trim().replace(/[_]/g, " ");
  const aliasHit = aliasMap[rawKey] ?? aliasMap[stripNoise(rawKey)];
  if (aliasHit) return aliasHit;
  let best: LocationRow | null = null;
  let bestScore = 0;
  for (const loc of cache) {
    const score = scoreMatch(raw, loc);
    if (score > bestScore) { bestScore = score; best = loc; }
  }
  return best && bestScore >= 55 ? best.slug : raw.toLowerCase().replace(/[_\-]/g, " ").trim();
}

const COMPAT_CASES: Array<{ input: string; expectedSlug: string; label: string }> = [
  { input: "smouha",             expectedSlug: "alexandria__smouha",          label: "old single-word area slug" },
  { input: "Smouha",             expectedSlug: "alexandria__smouha",          label: "old area slug with capital" },
  { input: "stanley",            expectedSlug: "alexandria__stanley",         label: "old area slug lowercase" },
  { input: "sidi_bishr",        expectedSlug: "alexandria__sidi_bishr",      label: "old underscore area slug" },
  { input: "nasr_city",         expectedSlug: "cairo__nasr_city",            label: "old underscore area slug (Cairo)" },
  { input: "nasr city",         expectedSlug: "cairo__nasr_city",            label: "old spaced area name" },
  { input: "Nasr City",         expectedSlug: "cairo__nasr_city",            label: "old capitalized area name" },
  { input: "maadi",              expectedSlug: "cairo__maadi",               label: "old area slug (Maadi)" },
  { input: "zamalek",            expectedSlug: "cairo__zamalek",             label: "old area slug (Zamalek)" },
  { input: "dokki",              expectedSlug: "giza__dokki",                label: "old area slug (Dokki)" },
  { input: "mohandessin",        expectedSlug: "giza__mohandessin",          label: "old area slug (Mohandessin)" },
  { input: "sixth_of_october",  expectedSlug: "giza__sixth_of_october",     label: "old area slug with underscores" },
  { input: "alexandria",         expectedSlug: "alexandria",                 label: "gov slug unchanged" },
  { input: "cairo",              expectedSlug: "cairo",                      label: "gov slug (Cairo)" },
  { input: "giza",               expectedSlug: "giza",                       label: "gov name resolves to gov slug (gov wins alias precedence)" },
  { input: "Alexandria",         expectedSlug: "alexandria",                 label: "gov nameEn capitalized" },
  { input: "الإسكندرية",          expectedSlug: "alexandria",                 label: "gov nameAr" },
  { input: "القاهرة",             expectedSlug: "cairo",                      label: "gov nameAr (Cairo)" },
  { input: "سموحة",               expectedSlug: "alexandria__smouha",         label: "area nameAr" },
  { input: "fleming",            expectedSlug: "alexandria__fleming",        label: "old area slug (Fleming)" },
  { input: "victoria",           expectedSlug: "alexandria__victoria",       label: "old area slug (Victoria)" },
  { input: "new cairo",          expectedSlug: "cairo__new_cairo",           label: "old area name with space" },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const { rows: cache } = await client.query<LocationRow>(
      "SELECT id, type, name_ar AS \"nameAr\", name_en AS \"nameEn\", parent_id AS \"parentId\", slug FROM locations"
    );
    const aliasMap = buildAliasMap(cache);

    let passed = 0;
    let failed = 0;

    for (const { input, expectedSlug, label } of COMPAT_CASES) {
      const got = resolve(input, cache, aliasMap);
      if (got === expectedSlug) {
        console.log(`  ✓ ${label}: "${input}" → "${got}"`);
        passed++;
      } else {
        console.error(`  ✗ ${label}: "${input}" → expected "${expectedSlug}", got "${got}"`);
        failed++;
      }
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
