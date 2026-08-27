import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApiBase } from "@/utils/api";

WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = "fanni_auth_token";

/** Google OIDC issuer (default). Override with EXPO_PUBLIC_ISSUER_URL if needed. */
const ISSUER_URL = process.env.EXPO_PUBLIC_ISSUER_URL ?? "https://accounts.google.com";

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

export type LoginResult = "success" | "cancel" | "dismiss" | "error" | "locked" | "opened" | "unknown" | "misconfigured";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<LoginResult>;
  logout: () => Promise<void>;
  setRole: (role: "client" | "technician" | "admin") => Promise<void>;
  refreshUser: () => Promise<void>;
  sessionToken: string | null;
  googleConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => "error",
  logout: async () => {},
  setRole: async () => {},
  refreshUser: async () => {},
  sessionToken: null,
  googleConfigured: false,
});

function getApiBaseUrl(): string {
  return getApiBase();
}

function getGoogleClientIds() {
  const web =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.EXPO_PUBLIC_OIDC_CLIENT_ID ||
    "";
  const android =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    web;
  const ios =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    web;
  return { web, android, ios };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const { web, android, ios } = getGoogleClientIds();
  const googleConfigured = Boolean(web || android || ios);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "mobile",
    path: "oauth",
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: web || undefined,
    androidClientId: android || undefined,
    iosClientId: ios || undefined,
    scopes: ["openid", "profile", "email"],
    redirectUri,
    // Authorization code + PKCE so the API can exchange via /mobile-auth/token-exchange
    responseType: AuthSession.ResponseType.Code,
    shouldAutoExchangeCode: false,
  });

  const fetchUser = useCallback(async (token?: string) => {
    try {
      const storedToken = token ?? (await SecureStore.getItemAsync(AUTH_TOKEN_KEY));
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
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
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

  useEffect(() => {
    if (response?.type !== "success" || !request?.codeVerifier) return;
    const { code, state } = response.params;
    if (!code) {
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        const apiBase = getApiBaseUrl();
        if (!apiBase) return;
        const exchangeRes = await fetch(`${apiBase}/api/mobile-auth/token-exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            code_verifier: request.codeVerifier,
            redirect_uri: redirectUri,
            state: state ?? "google",
            nonce: (request as unknown as Record<string, unknown>).nonce as string | undefined,
            issuer: ISSUER_URL,
          }),
        });
        if (!exchangeRes.ok) {
          setIsLoading(false);
          return;
        }
        const data = await exchangeRes.json();
        if (data.token) {
          await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
          setIsLoading(true);
          await fetchUser(data.token);
        }
      } catch {
        setIsLoading(false);
      }
    })();
  }, [response, request, redirectUri, fetchUser]);

  const login = useCallback(async (): Promise<LoginResult> => {
    if (!googleConfigured) {
      console.error("Google Sign-In misconfigured — set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID / ANDROID / IOS");
      return "misconfigured";
    }
    try {
      const result = await promptAsync();
      const type = result?.type;
      if (
        type === "success" ||
        type === "cancel" ||
        type === "dismiss" ||
        type === "error" ||
        type === "locked" ||
        type === "opened"
      ) {
        return type;
      }
      return "unknown";
    } catch (err) {
      console.error("Google login error:", err);
      return "error";
    }
  }, [promptAsync, googleConfigured]);

  const logout = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (token) {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/mobile-auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
    } finally {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem("catBannerDismissed");
      setUser(null);
      setSessionToken(null);
    }
  }, []);

  const setRole = useCallback(
    async (role: "client" | "technician" | "admin") => {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
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
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
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

        const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
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
        googleConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
