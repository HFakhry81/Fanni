/**
 * Shared API client for Fanni full-app E2E.
 * Prefer API for reliable state transitions; use UI for recorded evidence.
 */
const apiBase = () => process.env.E2E_API_URL ?? "https://api.upnexa-eg.com";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function api<T = unknown>(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : `${method} ${path} failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export function newId(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function healthz(): Promise<{ status: string }> {
  return api("GET", "/api/healthz");
}

export async function login(identifier: string, password: string): Promise<{
  token: string;
  user?: { id?: string; role?: string };
  role?: string;
}> {
  const trimmed = identifier.trim();
  const id = trimmed.includes("@")
    ? trimmed.toLowerCase()
    : (() => {
        const d = trimmed.replace(/\s|-/g, "");
        const m = d.match(/^(\+?20|0)(1[0125][0-9]{8})$/);
        return m ? `0${m[2]}` : d;
      })();
  return api("POST", "/api/auth/login-with-password", {
    body: { identifier: id, password },
  });
}

export async function getWallet(token: string): Promise<{
  pointsBalance?: number;
  promotionalBalance?: number;
  purchasedBalance?: number;
}> {
  return api("GET", "/api/wallet", { token });
}

export async function listPackages(token: string): Promise<{
  packages: Array<{ id: string; pointsAmount: number; priceEgp: string; isActive?: boolean }>;
}> {
  return api("GET", "/api/wallet/packages", { token });
}

export async function requestTopUp(
  token: string,
  body: {
    packageId?: string;
    amountEgp: number;
    pointsRequested: number;
    paymentMethod?: string;
    senderDetails?: Record<string, string>;
    referenceNumber?: string;
  },
): Promise<{ request: { id: string; status: string } }> {
  return api("POST", "/api/payments/request", { token, body });
}

export async function adminListPayments(
  token: string,
  status = "pending",
): Promise<{ requests: Array<{ id: string; status: string; userId?: string }> }> {
  return api("GET", `/api/admin/payments?status=${encodeURIComponent(status)}`, { token });
}

export async function adminConfirmPayment(token: string, requestId: string): Promise<unknown> {
  return api("PATCH", `/api/admin/payments/${requestId}/confirm`, { token, body: {} });
}

export async function adminRejectPayment(
  token: string,
  requestId: string,
  adminNotes = "E2E reject path",
): Promise<unknown> {
  return api("PATCH", `/api/admin/payments/${requestId}/reject`, {
    token,
    body: { adminNotes },
  });
}

export type CreateOrderInput = {
  category?: string;
  subCategory?: string;
  governorate?: string;
  area?: string;
  street?: string;
  problemDescription?: string;
  latitude?: number;
  longitude?: number;
};

export async function createOrder(token: string, input: CreateOrderInput = {}): Promise<{
  success: boolean;
  orderId: string;
  orderNumber?: string;
}> {
  const id = newId("ord");
  const category = input.category ?? process.env.E2E_ORDER_CATEGORY ?? "ac";
  const governorate = input.governorate ?? process.env.E2E_ORDER_GOVERNORATE ?? "alexandria";
  const area = input.area ?? process.env.E2E_ORDER_AREA ?? "alexandria__al_mandara";
  const body = {
    id,
    orderNumber: id,
    category,
    subCategory: input.subCategory ?? "maintenance",
    governorate,
    area,
    street: input.street ?? "E2E Test Street",
    buildingNo: "1",
    floorNo: "1",
    aptNo: "1",
    problemDescription: input.problemDescription ?? "E2E automated problem description",
    deviceType: "split",
    visitDate: new Date().toISOString().slice(0, 10),
    visitTime: "12:00",
    latitude: input.latitude ?? 31.2156,
    longitude: input.longitude ?? 29.9553,
    clientName: "E2E Client",
    clientMobile: process.env.E2E_CLIENT_IDENTIFIER ?? "01000000000",
  };
  const res = await api<{ success: boolean; orderId?: string; orderNumber?: string }>("POST", "/api/orders", {
    token,
    body,
  });
  return { success: !!res.success, orderId: res.orderId ?? id, orderNumber: res.orderNumber };
}

export async function cancelOrder(token: string, orderId: string): Promise<unknown> {
  return api("PATCH", `/api/orders/${orderId}/cancel`, { token, body: {} });
}

export async function declineOrder(token: string, orderId: string): Promise<unknown> {
  return api("POST", `/api/orders/${orderId}/decline`, { token, body: {} });
}

export async function acceptOrder(
  token: string,
  orderId: string,
  tech: { name?: string; mobile?: string } = {},
): Promise<Record<string, unknown>> {
  return api("POST", `/api/orders/${orderId}/accept`, {
    token,
    body: {
      technicianName: tech.name ?? "E2E Technician",
      technicianMobile: tech.mobile ?? process.env.E2E_TECH_IDENTIFIER ?? "",
      technicianRating: 4.8,
    },
  });
}

export async function startOrder(token: string, orderId: string): Promise<unknown> {
  return api("PATCH", `/api/orders/${orderId}/start`, { token, body: {} });
}

export async function completeOrder(token: string, orderId: string): Promise<unknown> {
  return api("PATCH", `/api/orders/${orderId}/complete`, {
    token,
    body: { solutionDescription: "E2E completed", clientSatisfaction: "satisfied" },
  });
}

export async function failService(
  token: string,
  orderId: string,
  reason = "client_not_present",
): Promise<unknown> {
  return api("PATCH", `/api/orders/${orderId}/fail-service`, {
    token,
    body: { reason, details: "E2E fail-service path" },
  });
}

export async function rateOrder(
  token: string,
  orderId: string,
  rating = 5,
  comment = "E2E rating",
): Promise<unknown> {
  return api("POST", `/api/orders/${orderId}/rate`, { token, body: { rating, comment } });
}

export async function techPendingOrders(token: string): Promise<{
  orders: Array<{ id: string; category?: string }>;
  meta?: { total: number };
}> {
  return api("GET", "/api/technician/pending-orders?limit=50", { token });
}

export async function techAssignedOrders(token: string): Promise<{
  orders: Array<{ id: string; status: string }>;
}> {
  return api("GET", "/api/technician/orders", { token });
}

export async function listAdminDisputes(token: string): Promise<{ disputes: unknown[] }> {
  return api("GET", "/api/admin/disputes", { token });
}

export async function createDispute(
  token: string,
  leadUnlockId: string,
  reason = "client_not_present",
): Promise<unknown> {
  return api("POST", "/api/disputes", { token, body: { leadUnlockId, reason } });
}

export async function adminBonusGrant(
  token: string,
  technicianId: string,
  pointsAmount = 10,
  message = "E2E bonus grant",
): Promise<unknown> {
  return api("POST", "/api/admin/wallet/bonus-grant", {
    token,
    body: { technicianId, pointsAmount, message },
  });
}

export async function pendingBonusGrants(token: string): Promise<{ grants: Array<{ id: string }> }> {
  return api("GET", "/api/wallet/bonus-grants/pending", { token });
}

export async function acknowledgeBonus(token: string, grantId: string): Promise<unknown> {
  return api("POST", `/api/wallet/bonus-grants/${grantId}/acknowledge`, { token, body: {} });
}

export function requireClientCreds(): boolean {
  return Boolean(process.env.E2E_CLIENT_IDENTIFIER && process.env.E2E_CLIENT_PASSWORD);
}
export function requireTechCreds(): boolean {
  return Boolean(process.env.E2E_TECH_IDENTIFIER && process.env.E2E_TECH_PASSWORD);
}
export function requireAdminCreds(): boolean {
  return Boolean(process.env.E2E_ADMIN_IDENTIFIER && process.env.E2E_ADMIN_PASSWORD);
}
export function requireAllRoles(): boolean {
  return requireClientCreds() && requireTechCreds() && requireAdminCreds();
}
