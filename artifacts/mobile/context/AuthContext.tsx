import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApiBase } from "@/utils/api";
import {
  deleteAuthToken,
  getAuthToken,
} from "@/utils/authTokenStorage";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: "client" | "technician" | "admin" | null;
  mobile: string | null;
  governorate: string | null;
  area: string | null;
  district: string | null;
  address: string | null;
  profession: string | null;
  specialty: string | null;
  serviceCategories?: string[] | null;
  isAvailable?: boolean | null;
  mustChangePassword?: boolean | null;
  serviceStart?: string | null;
  serviceEnd?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** @deprecated Social login removed — navigate to /login for password auth. */
  login: () => Promise<"misconfigured">;
  logout: () => Promise<void>;
  setRole: (role: "client" | "technician" | "admin") => Promise<void>;
  refreshUser: () => Promise<void>;
  sessionToken: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => "misconfigured",
  logout: async () => {},
  setRole: async () => {},
  refreshUser: async () => {},
  sessionToken: null,
});

function getApiBaseUrl(): string {
  return getApiBase();
}

/**
 * Session auth only (email/mobile + password via API).
 * Token storage: SecureStore on native, AsyncStorage (localStorage) on web.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const fetchUser = useCallback(async (token?: string) => {
    try {
      const storedToken = token ?? (await getAuthToken());
      if (!storedToken) {
        setUser(null);
        setSessionToken(null);
        setIsLoading(false);
        return;
      }
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/user`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user as AuthUser);
        setSessionToken(storedToken);
      } else {
        await deleteAuthToken();
        setUser(null);
        setSessionToken(null);
      }
    } catch {
      setUser(null);
      setSessionToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (): Promise<"misconfigured"> => {
    return "misconfigured";
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/mobile-auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
      }
    } catch {
      // still clear local session
    } finally {
      try {
        await deleteAuthToken();
      } catch {
        // ignore storage errors — still clear React state
      }
      try {
        await AsyncStorage.removeItem("catBannerDismissed");
        await AsyncStorage.removeItem("user");
      } catch {
        // ignore
      }
      setUser(null);
      setSessionToken(null);
    }
  }, []);

  const setRole = useCallback(async (role: "client" | "technician" | "admin") => {
    const token = await getAuthToken();
    if (!token) return;
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/auth/role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (data.user) {
      setUser(data.user as AuthUser);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = await getAuthToken();
    if (token) await fetchUser(token);
  }, [fetchUser]);

  useEffect(() => {
    if (!user || user.role !== "client" || !sessionToken) return;

    const apiBase = getApiBaseUrl();
    if (!apiBase) return;

    (async () => {
      try {
        if (Platform.OS === "web") return;
        if (Constants.appOwnership === "expo") return;

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Notifications = require("expo-notifications");

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const expoPushToken = tokenData.data;
        if (!expoPushToken) return;

        const storedToken = await getAuthToken();
        if (!storedToken) return;

        await fetch(`${apiBase}/api/auth/push-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${storedToken}`,
          },
          body: JSON.stringify({ token: expoPushToken }),
        });
      } catch {
        // expo-notifications not supported in this environment
      }
    })();
  }, [user?.id, user?.role, sessionToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        setRole,
        refreshUser,
        sessionToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
