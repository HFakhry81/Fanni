/** Shared DB ↔ mobile order status mapping (used by API routes). */

export type DbOrderStatus =
  | "pending"
  | "acknowledged"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export type MobileOrderStatus = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";

export function toMobileStatus(dbStatus: string | null | undefined): MobileOrderStatus {
  const s = String(dbStatus ?? "pending");
  if (s === "acknowledged" || s === "en_route" || s === "arrived") return "accepted";
  if (s === "in_progress") return "inProgress";
  if (s === "completed" || s === "cancelled" || s === "pending") return s;
  if (s === "accepted") return "accepted";
  if (s === "inProgress") return "inProgress";
  return "pending";
}

/** Expand a mobile filter into DB status values for SQL IN (...). */
export function mobileStatusToDbStatuses(mobile: string): DbOrderStatus[] {
  if (mobile === "accepted") return ["acknowledged", "en_route", "arrived"];
  if (mobile === "inProgress") return ["in_progress"];
  if (mobile === "pending") return ["pending"];
  if (mobile === "completed") return ["completed"];
  if (mobile === "cancelled") return ["cancelled"];
  return [];
}

export const ORDER_STATUS_LABELS_AR: Record<MobileOrderStatus, string> = {
  pending: "في الانتظار",
  accepted: "مقبول / في الطريق",
  inProgress: "جاري التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
};
