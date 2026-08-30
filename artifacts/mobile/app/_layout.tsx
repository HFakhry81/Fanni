import * as Sentry from "@sentry/react-native";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Platform, View, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import Toast from "@/components/Toast";
import { AppProvider, useApp, type User, type UserType } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OrderProvider } from "@/context/OrderContext";
import { sweepExpiredRouteCache } from "@/utils/routeCache";
import { getApiBase } from "@/utils/api";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { getAppBuildNumber, getAppReleaseId } from "@/constants/appIdentity";
import { getMobileSentryDsn, SENTRY_ORG, SENTRY_PROJECT } from "@/constants/sentryConfig";
import { getSuspensionNotice } from "@/utils/suspensionNotice";

const APP_RELEASE = getAppReleaseId();

// Single init only — do not double-init (wizard + lazy). enableNative stays false
// until a monitored APK smoke-tests clean; JS errors/unhandled still report to Sentry.
try {
  const sentryDsn = getMobileSentryDsn();
  Sentry.init({
    dsn: sentryDsn,
    enabled: Boolean(sentryDsn),
    debug: __DEV__,
    tracesSampleRate: 0.2,
    enableNative: false,
    environment: __DEV__ ? "development" : "production",
    release: APP_RELEASE,
    dist: getAppBuildNumber(),
    enableAutoSessionTracking: true,
  });
  Sentry.setTag("app.platform", Platform.OS);
  Sentry.setTag("app.channel", "eas-preview-apk");
  Sentry.setTag("app.publisher", "UpNexa");
  Sentry.setTag("sentry.org", SENTRY_ORG);
  Sentry.setTag("sentry.project", SENTRY_PROJECT);
  Sentry.addBreadcrumb({
    category: "app.lifecycle",
    message: "Sentry initialized for Fanni APK (UpNexa)",
    level: "info",
  });
} catch {
  // Launch must never depend on Sentry.
}

const LOC_CACHE_GOV_KEY = "location_cache_governorates";
const LOC_CACHE_AREAS_KEY = "location_cache_areas";

SplashScreen.preventAutoHideAsync();

// expo-notifications was removed from Expo Go in SDK 53. Guard with appOwnership
// so we never even require the module in Expo Go, preventing the "Uncaught Error" overlay.
if (Platform.OS !== "web" && Constants.appOwnership !== "expo") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const queryClient = new QueryClient();

interface LocationLabels {
  governorateId: string | null;
  governorateNameAr: string | undefined;
  governorateNameEn: string | undefined;
  areaId: string | null;
  areaNameAr: string | undefined;
  areaNameEn: string | undefined;
}


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

  const govCacheRef = useRef<Map<string, { ar: string; en: string }>>(new Map());
  const areaCacheRef = useRef<Map<string, { ar: string; en: string }>>(new Map());
  const [locCacheHydrated, setLocCacheHydrated] = useState(false);

  useEffect(() => {
    if (authUser?.id) {
      Sentry.setUser({
        id: authUser.id,
        // Avoid PII (phone/email) in crash reports.
        segment: authUser.role ?? "unknown",
      });
      Sentry.setTag("user.role", authUser.role ?? "unknown");
    } else {
      Sentry.setUser(null);
    }
  }, [authUser?.id, authUser?.role]);

  useEffect(() => {
    (async () => {
      try {
        const [govRaw, areaRaw] = await Promise.all([
          AsyncStorage.getItem(LOC_CACHE_GOV_KEY),
          AsyncStorage.getItem(LOC_CACHE_AREAS_KEY),
        ]);
        if (govRaw) {
          const parsed = JSON.parse(govRaw) as Record<string, { ar: string; en: string }>;
          for (const [id, label] of Object.entries(parsed)) {
            govCacheRef.current.set(id, label);
          }
        }
        if (areaRaw) {
          const parsed = JSON.parse(areaRaw) as Record<string, { ar: string; en: string }>;
          for (const [key, label] of Object.entries(parsed)) {
            areaCacheRef.current.set(key, label);
          }
        }
      } catch { /* ignore */ }
      setLocCacheHydrated(true);
    })();
  }, []);

  const [locationLabels, setLocationLabels] = useState<LocationLabels>({
    governorateId: null,
    governorateNameAr: undefined,
    governorateNameEn: undefined,
    areaId: null,
    areaNameAr: undefined,
    areaNameEn: undefined,
  });

  const [syncToastVisible, setSyncToastVisible] = useState(false);
  const [syncErrorToastVisible, setSyncErrorToastVisible] = useState(false);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  useEffect(() => {
    if (sessionToken === null) {
      lastForegroundSyncRef.current = 0;
    }
  }, [sessionToken]);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    refreshUserRef.current = refreshUser;
  }, [refreshUser]);

  useEffect(() => {
    const govId = authUser?.governorate ?? null;
    const areaId = authUser?.area ?? null;
    if (!govId) {
      setLocationLabels({ governorateId: null, governorateNameAr: undefined, governorateNameEn: undefined, areaId: null, areaNameAr: undefined, areaNameEn: undefined });
      return;
    }

    const govCached = govCacheRef.current.get(govId);
    const areaCacheKey = areaId ? `${govId}:${areaId}` : null;
    const areaCached = areaCacheKey ? areaCacheRef.current.get(areaCacheKey) : undefined;

    if (govCached && (!areaId || areaCached)) {
      setLocationLabels({
        governorateId: govId,
        governorateNameAr: govCached.ar,
        governorateNameEn: govCached.en,
        areaId,
        areaNameAr: areaCached?.ar,
        areaNameEn: areaCached?.en,
      });
      return;
    }

    const apiBase = getApiBase();
    if (!apiBase) return;

    (async () => {
      try {
        let govLabel = govCached;
        if (!govLabel) {
          const res = await fetch(`${apiBase}/api/locations/governorates`);
          const json = await res.json() as { governorates?: { id: string; nameAr: string; nameEn: string }[] };
          for (const g of json.governorates ?? []) {
            govCacheRef.current.set(g.id, { ar: g.nameAr, en: g.nameEn });
          }
          govLabel = govCacheRef.current.get(govId);
          AsyncStorage.setItem(
            LOC_CACHE_GOV_KEY,
            JSON.stringify(Object.fromEntries(govCacheRef.current)),
          ).catch(() => {});
        }

        let areaLabel = areaCached;
        if (areaId && areaCacheKey && !areaLabel) {
          const res = await fetch(`${apiBase}/api/locations/${govId}/areas`);
          const json = await res.json() as { areas?: { id: string; nameAr: string; nameEn: string }[] };
          for (const a of json.areas ?? []) {
            areaCacheRef.current.set(`${govId}:${a.id}`, { ar: a.nameAr, en: a.nameEn });
          }
          areaLabel = areaCacheKey ? areaCacheRef.current.get(areaCacheKey) : undefined;
          AsyncStorage.setItem(
            LOC_CACHE_AREAS_KEY,
            JSON.stringify(Object.fromEntries(areaCacheRef.current)),
          ).catch(() => {});
        }

        setLocationLabels({
          governorateId: govId,
          governorateNameAr: govLabel?.ar,
          governorateNameEn: govLabel?.en,
          areaId,
          areaNameAr: areaLabel?.ar,
          areaNameEn: areaLabel?.en,
        });
      } catch { /* ignore */ }
    })();
  }, [authUser?.governorate, authUser?.area, locCacheHydrated]);

  useEffect(() => {
    if (!isAvailabilityHydrated) return;
    if (authUser) {
      const displayName = [authUser.firstName, authUser.lastName]
        .filter(Boolean)
        .join(" ") || authUser.email || "User";
      const govId = authUser.governorate ?? undefined;
      const areaId = authUser.area ?? undefined;
      const govLabels = govId && locationLabels.governorateId === govId ? locationLabels : null;
      const areaLabels = areaId && locationLabels.areaId === areaId ? locationLabels : null;
      const appUserGovMatches = appUser?.governorate === govId;
      const appUserAreaMatches = appUser?.area === areaId;
      setUser({
        ...(appUser ?? {}),
        id: authUser.id,
        type: (authUser.role as UserType) ?? null,
        name: displayName,
        mobile: authUser.mobile ?? "",
        email: authUser.email ?? "",
        avatar:
          resolveMediaUrl(authUser.profileImageUrl, { token: sessionToken }) ??
          resolveMediaUrl(appUser?.avatar, { token: sessionToken }) ??
          undefined,
        governorate: govId,
        governorateNameAr: govLabels?.governorateNameAr ?? (appUserGovMatches ? appUser?.governorateNameAr : undefined),
        governorateNameEn: govLabels?.governorateNameEn ?? (appUserGovMatches ? appUser?.governorateNameEn : undefined),
        area: areaId,
        areaNameAr: areaLabels?.areaNameAr ?? (appUserAreaMatches ? appUser?.areaNameAr : undefined),
        areaNameEn: areaLabels?.areaNameEn ?? (appUserAreaMatches ? appUser?.areaNameEn : undefined),
        district: authUser.district ?? undefined,
        address: authUser.address ?? undefined,
        profession: authUser.profession ?? undefined,
        specialty: authUser.specialty ?? undefined,
        serviceCategories: authUser.serviceCategories ?? undefined,
        serviceStart: authUser.serviceStart ?? undefined,
        serviceEnd: authUser.serviceEnd ?? undefined,
        isApproved: (authUser as { isApproved?: boolean }).isApproved ?? undefined,
        approvalStatus: (authUser as { approvalStatus?: User["approvalStatus"] }).approvalStatus ?? undefined,
        experience: (authUser as { yearsOfExperience?: number | null }).yearsOfExperience ?? appUser?.experience,
      });
    } else {
      setUser(null);
      hasSynced.current = false;
      needsRetry.current = false;
      lastForegroundSyncRef.current = 0;
    }
    // appUser/setUser omitted: reading appUser for label fallbacks + setUser would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [authUser, isAvailabilityHydrated, locationLabels, sessionToken]);

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
    // Mount/hydrate sync once — syncAvailabilityFromServer identity changes would re-fire
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [isAvailabilityHydrated, authUser, sessionToken]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        retryPendingAvailabilityToggle()
          .then((ok) => {
            if (ok) setSyncToastVisible(true);
          })
          .catch(() => {});
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
                setSyncErrorToastVisible(true);
              }
            })
            .catch(() => {
              needsRetry.current = true;
              setSyncErrorToastVisible(true);
            });
        }
      }
    });
    return () => unsubscribe();
    // Subscribe once; handlers use refs for latest auth/token
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
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
            syncAvailabilityFromServer(sessionTokenRef.current)
              .then((ok) => {
                if (!ok) {
                  needsRetry.current = true;
                  setSyncErrorToastVisible(true);
                }
              })
              .catch(() => {
                needsRetry.current = true;
                setSyncErrorToastVisible(true);
              });
          }
        }
      }
    });
    return () => subscription.remove();
    // Subscribe once; handlers use refs
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
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
      <Toast
        visible={syncErrorToastVisible}
        message={t("availability.syncFailed")}
        duration={4000}
        variant="error"
        onHide={() => setSyncErrorToastVisible(false)}
      />
    </View>
  );
}

function SuspensionNoticeGate() {
  const { isLoading, user } = useAuth();
  const { isRTL } = useApp();

  useEffect(() => {
    if (isLoading || user) return;

    const showNotice = async () => {
      const reason = await getSuspensionNotice();
      if (!reason) return;
      Alert.alert(
        isRTL ? "حساب موقوف" : "Account suspended",
        isRTL
          ? `تم إيقاف حسابك للسبب التالي:\n\n${reason}`
          : `Your account was suspended for the following reason:\n\n${reason}`,
        [{ text: isRTL ? "حسناً" : "OK" }],
      );
    };

    void showNotice();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void showNotice();
    });
    return () => sub.remove();
  }, [isLoading, user, isRTL]);

  return null;
}

function RootLayoutNav() {
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
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const router = useRouter();

  useEffect(() => {
    sweepExpiredRouteCache();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    // expo-notifications removed from Expo Go SDK 53+ — skip to avoid error overlay
    if (Constants.appOwnership === "expo") return;

    let subscription: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require("expo-notifications");

      Notifications.getLastNotificationResponseAsync().then((response: { notification: { request: { content: { data: unknown } } } } | null) => {
        if (!response) return;
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        const orderId = data?.orderId;
        if (orderId && typeof orderId === "string") {
          router.push({ pathname: "/order-details", params: { orderId } });
        }
      }).catch(() => {});

      subscription = Notifications.addNotificationResponseReceivedListener((response: { notification: { request: { content: { data: unknown } } } }) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        const orderId = data?.orderId;
        if (orderId && typeof orderId === "string") {
          router.push({ pathname: "/order-details", params: { orderId } });
        }
      });
    } catch {
      // expo-notifications not available in Expo Go SDK 53+
    }

    return () => { subscription?.remove(); };
  }, [router]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary
        onError={(error, stackTrace) => {
          Sentry.captureException(error, { extra: { componentStack: stackTrace } });
        }}
      >
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppProvider>
              <AuthProvider>
                <SuspensionNoticeGate />
                <AuthUserBridge>
                  <OrderProvider>
                    <RootLayoutNav />
                  </OrderProvider>
                </AuthUserBridge>
              </AuthProvider>
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
export default Sentry.wrap(RootLayout);

