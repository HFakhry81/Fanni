/**
 * Shared API client for Fanni full-app E2E.
 * Prefer API for reliable state transitions; use UI for recorded evidence.
 * Mutating calls are blocked against production unless E2E_ALLOW_PROD_WRITES=1.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertWritesAllowed,
  resolveApiBaseUrl,
} from "./prodSafety";

const apiBase = () => resolveApiBaseUrl();

export {
  isProductionTarget,
  prodWritesAllowed,
  requireWritableTarget,
  writesAllowed,
  writesBlockedReason,
} from "./prodSafety";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
  }
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function api<T = unknown>(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown; allowWrite?: boolean },
): Promise<T> {
  const upper = method.toUpperCase();
  const isLogin = upper === "POST" && path.includes("/auth/login");
  if (WRITE_METHODS.has(upper) && !isLogin && opts?.allowWrite !== true) {
    assertWritesAllowed(`${upper} ${path}`);
  }
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

type LoginResult = {
  token: string;
  user?: { id?: string; role?: string };
  role?: string;
};

const loginCache = new Map<string, LoginResult>();
const loginCacheFile = path.join(os.tmpdir(), "fanni-e2e-login-cache.json");

function loadDiskCache(): void {
  if (loginCache.size > 0) return;
  try {
    if (!fs.existsSync(loginCacheFile)) return;
    const raw = JSON.parse(fs.readFileSync(loginCacheFile, "utf8")) as Record<string, LoginResult>;
    for (const [k, v] of Object.entries(raw)) {
      if (v?.token) loginCache.set(k, v);
    }
  } catch {
    /* ignore */
  }
}

function saveDiskCache(): void {
  try {
    const obj: Record<string, LoginResult> = {};
    for (const [k, v] of loginCache.entries()) obj[k] = v;
    fs.writeFileSync(loginCacheFile, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Cached login with backoff on rate-limit — reuse tokens across logic suite. */
export async function loginCached(identifier: string, password: string): Promise<LoginResult> {
  loadDiskCache();
  const key = `${identifier.trim().toLowerCase()}::${password}`;
  const hit = loginCache.get(key);
  if (hit?.token) return hit;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const result = await login(identifier, password);
      loginCache.set(key, result);
      saveDiskCache();
      return result;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const rateLimited =
        (err instanceof ApiError && (err.status === 429 || err.status === 403)) ||
        /too many login|rate.?limit|wait before trying/i.test(msg);
      if (!rateLimited) throw err;
      const waitMs = Math.min(60_000, 3_000 * 2 ** attempt);
      await sleep(waitMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function clearLoginCache(): void {
  loginCache.clear();
  try {
    fs.unlinkSync(loginCacheFile);
  } catch {
    /* ignore */
  }
}

export async function getWallet(token: string): Promise<{
  pointsBalance?: number;
  promotionalBalance?: number;
  purchasedBalance?: number;
}> {
  const data = await api<{
    wallet?: {
      pointsBalance?: number;
      promotionalBalance?: number;
      purchasedBalance?: number;
      points_balance?: number;
      promotional_balance?: number;
      purchased_balance?: number;
    };
    pointsBalance?: number;
    promotionalBalance?: number;
    purchasedBalance?: number;
  }>("GET", "/api/wallet", { token });
  const w = data.wallet ?? data;
  return {
    pointsBalance: Number(w.pointsBalance ?? w.points_balance ?? data.pointsBalance ?? 0),
    promotionalBalance: Number(
      w.promotionalBalance ?? w.promotional_balance ?? data.promotionalBalance ?? 0,
    ),
    purchasedBalance: Number(
      w.purchasedBalance ?? w.purchased_balance ?? data.purchasedBalance ?? 0,
    ),
  };
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

/** Client confirms tech arrival → in_progress (optional path vs tech /start). */
export async function confirmArrival(
  token: string,
  orderId: string,
  confirmed = true,
  rejectionReason?: string,
): Promise<unknown> {
  return api("PATCH", `/api/orders/${orderId}/confirm-arrival`, {
    token,
    body: { confirmed, rejectionReason },
  });
}

export async function getOrder(
  token: string,
  orderId: string,
): Promise<{ id?: string; status?: string; orderNumber?: string; data?: Record<string, unknown> }> {
  // Prefer dedicated GET when available; fall back to client list.
  try {
    return await api("GET", `/api/orders/${orderId}`, { token });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    const list = await api<{ orders?: Array<Record<string, unknown>> }>("GET", "/api/orders?limit=50", {
      token,
    });
    const hit = (list.orders || []).find((o) => String(o.id) === orderId);
    if (!hit) throw err;
    return {
      id: String(hit.id),
      status: String(
        hit.status ??
          (hit.data as { status?: string } | undefined)?.status ??
          "",
      ),
      orderNumber: hit.orderNumber ? String(hit.orderNumber) : undefined,
      data: (hit.data as Record<string, unknown>) || undefined,
    };
  }
}

export async function completeOrder(token: string, orderId: string): Promise<unknown> {
  return api("PATCH", `/api/orders/${orderId}/complete`, {
    token,
    body: { solutionDescription: "E2E completed", clientSatisfaction: "satisfied" },
  });
}

/** Fail-service reasons from API ALLOWED list. */
export type FailServiceReason =
  | "client_not_present"
  | "client_refused"
  | "different_problem"
  | "parts_unavailable"
  | "extra_time"
  | "cannot_repair"
  | "other";

export async function failService(
  token: string,
  orderId: string,
  reason: FailServiceReason = "client_not_present",
  details = "E2E fail-service path",
): Promise<{ success?: boolean; refundRequested?: boolean }> {
  return api("PATCH", `/api/orders/${orderId}/fail-service`, {
    token,
    body: { reason, details },
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

export async function listAdminDisputes(token: string): Promise<{
  disputes: Array<{
    id: string;
    status?: string;
    orderId?: string;
    reason?: string;
    pointsRefunded?: boolean;
  }>;
}> {
  return api("GET", "/api/admin/disputes", { token });
}

export async function adminResolveDispute(
  token: string,
  disputeId: string,
  action: "approve" | "reject",
  adminNotes = "E2E dispute resolve",
): Promise<unknown> {
  return api("PATCH", `/api/admin/disputes/${disputeId}`, {
    token,
    body: { action, adminNotes },
  });
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

/** Grant welcome points only via approve — do not invent points. */
export async function adminApproveTechnician(
  token: string,
  technicianId: string,
): Promise<{ success?: boolean; approved?: boolean; welcomePointsGranted?: boolean | number }> {
  return api("PATCH", `/api/admin/technicians/${technicianId}/approve`, { token, body: {} });
}

export async function adminListPendingTechnicians(token: string): Promise<{
  technicians?: Array<{ id: string; mobile?: string }>;
}> {
  return api("GET", "/api/admin/technicians/pending", { token });
}

/** Ensure tech has points via top-up + admin confirm (local / allow-prod-writes only). */
export async function ensureTechPoints(
  techToken: string,
  adminToken: string,
  minPoints = 25,
): Promise<number> {
  const before = await getWallet(techToken);
  const bal = before.pointsBalance ?? 0;
  if (bal >= minPoints) return bal;

  const pkgs = await listPackages(techToken);
  const pkg = pkgs.packages?.[0];
  if (!pkg) throw new Error("No point packages available for top-up");

  const { request } = await requestTopUp(techToken, {
    packageId: pkg.id,
    amountEgp: Number(pkg.priceEgp) || 50,
    pointsRequested: pkg.pointsAmount || 60,
    paymentMethod: "instapay",
    senderDetails: { instapayId: "e2e-logic@instapay" },
    referenceNumber: `LOGIC-${Date.now()}`,
  });
  await adminConfirmPayment(adminToken, request.id);
  // Confirm can be slightly async in ledger paths — poll briefly
  for (let i = 0; i < 8; i++) {
    const after = await getWallet(techToken);
    const bal = after.pointsBalance ?? 0;
    if (bal >= minPoints) return bal;
    await sleep(500);
  }
  const finalBal = (await getWallet(techToken)).pointsBalance ?? 0;
  if (finalBal < minPoints) {
    throw new Error(
      `ensureTechPoints: after top-up+confirm balance=${finalBal} (wanted >= ${minPoints})`,
    );
  }
  return finalBal;
}

/** Accept → start → complete helper for happy path. */
export async function runHappyJob(
  clientToken: string,
  techToken: string,
  techMeta?: { name?: string; mobile?: string },
): Promise<{ orderId: string }> {
  const created = await createOrder(clientToken);
  await acceptOrder(techToken, created.orderId, techMeta);
  await startOrder(techToken, created.orderId);
  await completeOrder(techToken, created.orderId);
  await rateOrder(clientToken, created.orderId, 5, "E2E logic happy path");
  return { orderId: created.orderId };
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
