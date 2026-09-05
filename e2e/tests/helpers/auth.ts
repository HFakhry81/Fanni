import { resolveApiBaseUrl } from "./prodSafety";

const apiBase = () => resolveApiBaseUrl();

function normalizeLoginIdentifierValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const mobileDigits = trimmed.replace(/\s|-/g, "");
  const match = mobileDigits.match(/^(\+?20|0)(1[0125][0-9]{8})$/);
  return match ? `0${match[2]}` : mobileDigits;
}

export interface LoginResult {
  token: string;
  role?: string;
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  const res = await fetch(`${apiBase()}/api/auth/login-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: normalizeLoginIdentifierValue(identifier), password }),
  });
  const data = (await res.json()) as { token?: string; error?: string; role?: string };
  if (!res.ok || !data.token) {
    throw new Error(data.error ?? `Login failed (${res.status})`);
  }
  return { token: data.token, role: data.role };
}

export function hasClientCreds(): boolean {
  return Boolean(process.env.E2E_CLIENT_IDENTIFIER && process.env.E2E_CLIENT_PASSWORD);
}

export function hasTechCreds(): boolean {
  return Boolean(process.env.E2E_TECH_IDENTIFIER && process.env.E2E_TECH_PASSWORD);
}

export function hasAdminCreds(): boolean {
  return Boolean(process.env.E2E_ADMIN_IDENTIFIER && process.env.E2E_ADMIN_PASSWORD);
}

