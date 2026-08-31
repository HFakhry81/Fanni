const apiBase = process.env.E2E_API_URL ?? "https://api.upnexa-eg.com";

export interface LoginResult {
  token: string;
  role?: string;
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  const res = await fetch(`${apiBase}/api/auth/login-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
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
