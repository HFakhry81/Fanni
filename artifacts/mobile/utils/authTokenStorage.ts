import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Shared session token key (SecureStore on native, localStorage via AsyncStorage on web). */
export const AUTH_TOKEN_KEY = "fanni_auth_token";

async function clearWebLocalToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key === AUTH_TOKEN_KEY || key.endsWith(AUTH_TOKEN_KEY) || key.includes("fanni_auth_token")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // private mode / blocked storage
  }
}

/**
 * expo-secure-store is native-only and throws on web.
 * Persist the bearer token with AsyncStorage (localStorage) in browsers.
 */
export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    const fromAsync = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (fromAsync) return fromAsync;
    if (typeof localStorage !== "undefined") {
      try {
        return localStorage.getItem(AUTH_TOKEN_KEY);
      } catch {
        return null;
      }
    }
    return null;
  }
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } catch {
        // AsyncStorage write already attempted
      }
    }
    return;
  }
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function deleteAuthToken(): Promise<void> {
  if (Platform.OS === "web") {
    await clearWebLocalToken();
    return;
  }
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  // Also clear web/local leftovers if any (e.g. after switching platforms in tests)
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

