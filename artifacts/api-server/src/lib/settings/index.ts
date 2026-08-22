import { db, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const SETTING_KEYS = {
  INITIAL_MATCHING_RADIUS: "initial_matching_radius",
  MAX_MATCHING_RADIUS: "max_matching_radius",
  RADIUS_EXPANSION_STEP: "radius_expansion_step",
  ARRIVAL_GEOFENCE_RADIUS: "arrival_geofence_radius",
  LOCATION_ACCURACY_THRESHOLD: "location_accuracy_threshold",
  LOCATION_FRESHNESS_THRESHOLD_MINS: "location_freshness_threshold_mins",
  ARRIVAL_TIMEOUT_MINS: "arrival_timeout_mins",
  /** Percent 0–100. Default 0 — never hardcode an OPay (or other gateway) rate. */
  PAYMENT_GATEWAY_FEE_PERCENT: "payment_gateway_fee_percent",
} as const;

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const [setting] = await db
      .select()
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, key));
    
    return setting ? (setting.value as T) : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

export async function setSetting(key: string, value: any, adminId?: string) {
  await db
    .insert(systemSettingsTable)
    .values({
      key,
      value,
      updatedBy: adminId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: {
        value,
        updatedBy: adminId,
        updatedAt: new Date(),
      },
    });
}
