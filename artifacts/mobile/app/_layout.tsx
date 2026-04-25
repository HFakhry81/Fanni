import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { AppState, I18nManager, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import Toast from "@/components/Toast";
import { AppProvider, useApp, type UserType } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OrderProvider } from "@/context/OrderContext";
import { sweepExpiredRouteCache } from "@/utils/routeCache";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthUserBridge({ children }: { children: React.ReactNode }) {
  const { user: authUser, sessionToken, refreshUser } = useAuth();
  const { user: appUser, setUser, syncAvailabilityFromServer, retryPendingAvailabilityToggle, isAvailabilityHydrated, t } = useApp();
  const hasSynced = React.useRef(false);
  const needsRetry = React.useRef(false);
  const sessionTokenRef = React.useRef<string | null | undefined>(null);
  const authUserRef = React.useRef<typeof authUser>(null);
  const refreshUserRef = React.useRef(refreshUser);
  const lastForegroundSyncRef = React.useRef<number>(0);
  const FOREGROUND_SYNC_DEBOUNCE_MS = 30_000;

  const [syncToastVisible, setSyncToastVisible] = useState(false);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    refreshUserRef.current = refreshUser;
  }, [refreshUser]);

  useEffect(() => {
    if (!isAvailabilityHydrated) return;
    if (authUser) {
      const displayName = [authUser.firstName, authUser.lastName]
        .filter(Boolean)
        .join(" ") || authUser.email || "User";
      setUser({
        id: authUser.id,
        type: (authUser.role as UserType) ?? null,
        name: displayName,
        mobile: authUser.mobile ?? "",
        email: authUser.email ?? "",
        avatar: authUser.profileImageUrl ?? undefined,
        governorate: authUser.governorate ?? undefined,
        area: authUser.area ?? undefined,
        district: authUser.district ?? undefined,
        profession: authUser.profession ?? undefined,
        specialty: authUser.specialty ?? undefined,
        serviceCategories: authUser.serviceCategories,
      });
    } else {
      setUser(null);
      hasSynced.current = false;
      needsRetry.current = false;
    }
  }, [authUser, isAvailabilityHydrated]);

  useEffect(() => {
    if (
      !hasSynced.current &&
      isAvailabilityHydrated &&
      authUser?.role === "technician" &&
      authUser?.id &&
      sessionToken
    ) {
      hasSynced.current = true;
      syncAvailabilityFromServer(sessionToken)
        .then(() => {})
        .catch(() => {
          needsRetry.current = true;
        });
    }
  }, [isAvailabilityHydrated, authUser, sessionToken]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        retryPendingAvailabilityToggle().catch(() => {});
        if (
          needsRetry.current &&
          authUserRef.current?.role === "technician" &&
          sessionTokenRef.current
        ) {
          needsRetry.current = false;
          syncAvailabilityFromServer(sessionTokenRef.current)
            .then((ok) => {
              if (ok) {
                setSyncToastVisible(true);
              } else {
                needsRetry.current = true;
              }
            })
            .catch(() => {
              needsRetry.current = true;
            });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && authUserRef.current) {
        const now = Date.now();
        if (now - lastForegroundSyncRef.current >= FOREGROUND_SYNC_DEBOUNCE_MS) {
          lastForegroundSyncRef.current = now;
          refreshUserRef.current().catch(() => {});
          if (
            authUserRef.current.role === "technician" &&
            sessionTokenRef.current
          ) {
            syncAvailabilityFromServer(sessionTokenRef.current).catch(() => {
              needsRetry.current = true;
            });
          }
        }
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      <Toast
        visible={syncToastVisible}
        message={t("availability.synced")}
        duration={3000}
        onHide={() => setSyncToastVisible(false)}
      />
    </View>
  );
}

function RootLayoutNav() {
  const { isRTL } = useApp();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="select-role" />
      <Stack.Screen name="register" />
      <Stack.Screen name="register-success" />
      <Stack.Screen name="new-order" />
      <Stack.Screen name="order-details" />
      <Stack.Screen name="order-tracking" />
      <Stack.Screen name="(client)" />
      <Stack.Screen name="(tech)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  useEffect(() => {
    sweepExpiredRouteCache();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppProvider>
                <AuthProvider>
                  <AuthUserBridge>
                    <OrderProvider>
                      <RootLayoutNav />
                    </OrderProvider>
                  </AuthUserBridge>
                </AuthProvider>
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
