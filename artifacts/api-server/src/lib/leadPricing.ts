import { and, desc, eq, sql } from "drizzle-orm";
import { db, leadPricingRulesTable, unlockCostsTable } from "@workspace/db";

export const DEFAULT_LEAD_COST = 20;

export type LeadPricingRule = {
  serviceCategory: string | null;
  serviceSpecialization: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  pointsCost: number;
  priority: number;
};

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function isTimeInRange(nowMins: number, start: string | null, end: string | null): boolean {
  if (!start || !end) return true;
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === e) return true;
  if (s < e) return nowMins >= s && nowMins < e;
  return nowMins >= s || nowMins < e;
}

function specificity(rule: LeadPricingRule): number {
  return (rule.serviceCategory ? 1 : 0)
    + (rule.serviceSpecialization ? 2 : 0)
    + (rule.dayOfWeek != null ? 1 : 0)
    + (rule.startTime && rule.endTime ? 1 : 0);
}

export function pickLeadCostFromRules(
  rules: LeadPricingRule[],
  opts: { category?: string | null; specialty?: string | null; at?: Date },
): number | null {
  const at = opts.at ?? new Date();
  const cairo = new Date(at.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const day = cairo.getDay();
  const nowMins = cairo.getHours() * 60 + cairo.getMinutes();
  const category = (opts.category ?? "").toLowerCase();
  const specialty = (opts.specialty ?? "").toLowerCase();

  const matched = rules.filter((rule) => {
    if (rule.serviceCategory && rule.serviceCategory.toLowerCase() !== category) return false;
    if (rule.serviceSpecialization && rule.serviceSpecialization.toLowerCase() !== specialty) return false;
    if (rule.dayOfWeek != null && rule.dayOfWeek !== day) return false;
    if (!isTimeInRange(nowMins, rule.startTime, rule.endTime)) return false;
    return true;
  });

  if (matched.length === 0) return null;
  matched.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return specificity(b) - specificity(a);
  });
  return matched[0]!.pointsCost;
}

export async function loadActiveLeadPricingRules(): Promise<LeadPricingRule[]> {
  try {
    return await db
      .select()
      .from(leadPricingRulesTable)
      .where(eq(leadPricingRulesTable.isActive, true))
      .orderBy(desc(leadPricingRulesTable.priority));
  } catch {
    return [];
  }
}

export async function resolveLeadCost(opts: {
  category?: string | null;
  specialty?: string | null;
  at?: Date;
}): Promise<number> {
  const rules = await loadActiveLeadPricingRules();
  const fromRules = pickLeadCostFromRules(rules, opts);
  if (fromRules != null) return fromRules;

  try {
    if (opts.specialty) {
      const [row] = await db.select().from(unlockCostsTable).where(eq(unlockCostsTable.specialtySlug, opts.specialty));
      if (row) return row.pointsCost;
    }
    if (opts.category) {
      const [row] = await db.select().from(unlockCostsTable).where(eq(unlockCostsTable.categorySlug, opts.category));
      if (row) return row.pointsCost;
    }
    const [def] = await db
      .select()
      .from(unlockCostsTable)
      .where(and(sql`specialty_slug IS NULL`, sql`category_slug IS NULL`));
    if (def) return def.pointsCost;
  } catch {
    /* fall through to default */
  }
  return DEFAULT_LEAD_COST;
}
