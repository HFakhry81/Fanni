import { useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

export interface LocalProfileFields {
  address?: string;
  serviceStart?: string;
  serviceEnd?: string;
}

export interface SaveProfileResult {
  ok: boolean;
  error?: string;
}

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

export function useSaveProfile() {
  const { user, setUser } = useApp();
  const { refreshUser, sessionToken } = useAuth();

  const saveProfile = useCallback(
    async (
      patchBody: Record<string, unknown>,
      localFields: LocalProfileFields = {}
    ): Promise<SaveProfileResult> => {
      const apiBase = getApiBase();

      if (!sessionToken || !apiBase) {
        return { ok: false, error: "offline" };
      }

      let res: Response;
      try {
        res = await fetch(`${apiBase}/api/auth/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(patchBody),
        });
      } catch {
        return { ok: false, error: "offline" };
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        return { ok: false, error: data.error };
      }

      if (user && Object.keys(localFields).length > 0) {
        await setUser({ ...user, ...localFields });
      }

      await refreshUser();

      return { ok: true };
    },
    [user, setUser, refreshUser, sessionToken]
  );

  return { saveProfile };
}
