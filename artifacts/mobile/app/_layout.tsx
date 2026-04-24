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
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nManager } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp, type UserType } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OrderProvider } from "@/context/OrderContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthUserBridge({ children }: { children: React.ReactNode }) {
  const { user: authUser, sessionToken } = useAuth();
  const { user: appUser, setUser, syncAvailabilityFromServer, isAvailabilityHydrated } = useApp();
  const hasSynced = React.useRef(false);
  const needsRetry = React.useRef(false);
  const sessionTokenRef = React.useRef<string | null | undefined>(null);
  const authUserRef = React.useRef<typeof authUser>(null);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

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
        governorate: authUser.governorate ?? undefined,
        area: authUser.area ?? undefined,
        district: authUser.district ?? undefined,
        profession: authUser.profession ?? undefined,
        specialty: authUser.specialty ?? undefined,
        serviceCategories: authUser.serviceCategories ?? (appUser?.id === authUser.id ? appUser?.serviceCategories : undefined),
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
      if (
        state.isConnected &&
        needsRetry.current &&
        authUserRef.current?.role === "technician" &&
        sessionTokenRef.current
      ) {
        needsRetry.current = false;
        syncAvailabilityFromServer(sessionTokenRef.current).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  return <>{children}</>;
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
