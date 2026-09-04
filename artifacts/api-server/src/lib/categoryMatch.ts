/**
 * Canonical service-category matching.
 * Orders use keys like "electricity"; technicians often store service_domains UUIDs.
 */
import { db, serviceDomainsTable } from "@workspace/db";

function routingKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  electricity: ["electricity", "electrician", "electric", "electrical", "كهرباء", "كهربائي"],
  plumbing: ["plumbing", "plumber", "سباكة", "سباك"],
  ac: ["ac", "airconditioning", "air conditioning", "hvac", "تكييف", "مكيفات"],
  carpentry: ["carpentry", "carpenter", "نجارة", "نجار"],
  appliances: ["appliances", "appliance", "electronics", "أجهزة", "أجهزةمنزلية", "اجهزةمنزلية"],
  painting: ["painting", "painter", "دهانات", "دهان"],
  pest: ["pest", "pestcontrol", "pest control", "حشرات", "مكافحة", "مكافحةحشرات"],
  flooring: ["flooring", "floor", "tiles", "أرضيات", "بلاط", "ارضيات"],
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let domainCanonicalById: Map<string, string> | null = null;
let domainCacheAt = 0;
const DOMAIN_CACHE_TTL_MS = 60_000;

export function canonicalCategory(value: unknown): string {
  const key = routingKey(value);
  if (!key) return "";
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((alias) => routingKey(alias) === key)) return canonical;
  }
  return key;
}

async function loadDomainCanonicalMap(): Promise<Map<string, string>> {
  if (domainCanonicalById && Date.now() - domainCacheAt < DOMAIN_CACHE_TTL_MS) {
    return domainCanonicalById;
  }
  const rows = await db
    .select({
      id: serviceDomainsTable.id,
      nameEn: serviceDomainsTable.nameEn,
      nameAr: serviceDomainsTable.nameAr,
    })
    .from(serviceDomainsTable);
  const map = new Map<string, string>();
  for (const row of rows) {
    const fromEn = canonicalCategory(row.nameEn);
    const fromAr = canonicalCategory(row.nameAr);
    map.set(row.id, fromEn || fromAr || routingKey(row.nameEn) || routingKey(row.nameAr));
  }
  domainCanonicalById = map;
  domainCacheAt = Date.now();
  return map;
}

/** Resolve a stored category (UUID domain id or free-text) to a canonical key. */
export async function resolveCanonicalCategory(value: unknown): Promise<string> {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (UUID_RE.test(raw)) {
    const map = await loadDomainCanonicalMap();
    const fromDomain = map.get(raw);
    if (fromDomain) return fromDomain;
  }
  return canonicalCategory(raw);
}

export async function categoryMatches(
  orderCategory: unknown,
  technicianCategories: string[] | null | undefined,
): Promise<boolean> {
  const orderKey = await resolveCanonicalCategory(orderCategory);
  if (!orderKey) return false;
  if (!technicianCategories || technicianCategories.length === 0) return true;
  for (const category of technicianCategories) {
    const techKey = await resolveCanonicalCategory(category);
    if (techKey && techKey === orderKey) return true;
  }
  return false;
}

/** Eagerly resolve tech categories to canonical keys (for WS meta). */
export async function resolveTechnicianCategoryKeys(
  technicianCategories: string[] | null | undefined,
): Promise<string[]> {
  if (!technicianCategories?.length) return [];
  const keys: string[] = [];
  for (const category of technicianCategories) {
    const key = await resolveCanonicalCategory(category);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}
