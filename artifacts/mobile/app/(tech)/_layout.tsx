import { Tabs, Redirect } from "expo-router";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, View, Text, useColorScheme, Animated } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders, buildSimulatedOrder } from "@/context/OrderContext";
import { TechWsProvider, useTechWs } from "@/context/TechWsContext";
import Toast from "@/components/Toast";
import ConnectionBanner, { CONNECTION_BANNER_HEIGHT } from "@/components/ConnectionBanner";
import SyncingBanner from "@/components/SyncingBanner";
import { getApiBase } from "@/utils/api";

function CountBadge({ count }: { count: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [count, scaleAnim]);

  const label = count > 99 ? "99+" : String(count);

  return (
    <Animated.View
      style={[
        styles.countBadge,
        label.length > 2 ? styles.countBadgeWide : null,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Text style={styles.countBadgeText}>{label}</Text>
    </Animated.View>
  );
}

function NativeTechTabs({ availablePendingCount, unreadCompletedCount, profileSetupIncomplete }: { availablePendingCount: number; unreadCompletedCount: number; profileSetupIncomplete: boolean }) {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="map">
        <Icon sf={{ default: "map", selected: "map.fill" }} />
        <Label>Map</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="available-orders">
        <Icon sf={{ default: "tray", selected: "tray.fill" }} />
        <Label>Available</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet" }} />
        <Label>Orders</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="invoices">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>Invoices</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet">
        <Icon sf={{ default: "creditcard", selected: "creditcard.fill" }} />
        <Label>Wallet</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function DotBadge() {
  return <View style={styles.dotBadge} />;
}

function ClassicTechTabs() {
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { availablePendingCount, unreadCompletedCount } = useOrders();
  const profileSetupIncomplete = !user?.serviceCategories || user.serviceCategories.length === 0;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: t("nav.map"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>🗺️</Text>,
        }}
      />
      <Tabs.Screen
        name="available-orders"
        options={{
          title: isRTL ? "المتاحة" : "Available",
          tabBarBadge: availablePendingCount > 0 ? (availablePendingCount > 99 ? "99+" : availablePendingCount) : undefined,
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>📥</Text>,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("nav.orders"),
          tabBarIcon: () =>
            isIOS ? null : (
              <View>
                <Text style={styles.tabIcon}>📋</Text>
                {unreadCompletedCount > 0 && <CountBadge count={unreadCompletedCount} />}
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: t("nav.invoices"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>📄</Text>,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: isRTL ? "المحفظة" : "Wallet",
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>💳</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: () =>
            isIOS ? null : (
              <View>
                <Text style={styles.tabIcon}>👤</Text>
                {profileSetupIncomplete && <DotBadge />}
              </View>
            ),
        }}
      />
    </Tabs>
  );
}

const ADMIN_AVAILABILITY_MESSAGES = {
  online: {
    en: "An admin has set you as available",
    ar: "قام المشرف بتعيينك كمتاح",
  },
  offline: {
    en: "An admin has set you as unavailable",
    ar: "قام المشرف بتعيينك كغير متاح",
  },
};

const DEDUP_WINDOW_MS = 2000;

const ORDER_CANCELLED_MESSAGES = {
  en: "An order was cancelled by the client",
  ar: "طلب تم إلغاؤه بواسطة العميل",
};

function useOrderCancelledNotification(onCancelled: () => void) {
  const { subscribeOrderCancelled } = useTechWs();
  const onCancelledRef = useRef(onCancelled);
  onCancelledRef.current = onCancelled;

  const callback = useCallback((_orderId: string) => {
    onCancelledRef.current();
  }, []);

  useEffect(() => {
    return subscribeOrderCancelled(callback);
  }, [subscribeOrderCancelled, callback]);
}

function useAdminAvailabilityNotification(onChanged: (isAvailable: boolean) => void) {
  const { sessionToken } = useAuth();
  const { subscribeAvailabilityChanged } = useTechWs();
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const lastShownAtRef = useRef<number>(0);

  const deduplicatedCallback = useCallback((isAvailable: boolean) => {
    const now = Date.now();
    if (now - lastShownAtRef.current < DEDUP_WINDOW_MS) return;
    lastShownAtRef.current = now;
    onChangedRef.current(isAvailable);
  }, []);

  useEffect(() => {
    return subscribeAvailabilityChanged(deduplicatedCallback);
  }, [subscribeAvailabilityChanged, deduplicatedCallback]);

  useEffect(() => {
    if (!getApiBase() || !sessionToken) return;

    async function fetchPending() {
      try {
        const res = await fetch(`${getApiBase()}/api/technician/notifications`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) return;
        const json = await res.json() as { notifications?: Array<{ type: string; payload: { isAvailable?: boolean } }> };
        for (const n of json.notifications ?? []) {
          if (n.type === "availability_changed_by_admin" && typeof n.payload?.isAvailable === "boolean") {
            deduplicatedCallback(n.payload.isAvailable);
          }
        }
      } catch (_) {}
    }

    fetchPending();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchPending();
    });
    return () => sub.remove();
  }, [sessionToken]);
}

const DEMO_ORDER_DELAY_MS = 8000;

function useDemoOrderBroadcast() {
  const { user, isOnline } = useApp();
  const { injectNewOrder } = useOrders();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isOnline) {
      injectedRef.current = false;
      return;
    }
    if (injectedRef.current) return;
    timerRef.current = setTimeout(() => {
      injectedRef.current = true;
      injectNewOrder(buildSimulatedOrder(user?.serviceCategories ?? []));
    }, DEMO_ORDER_DELAY_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOnline, user?.serviceCategories, injectNewOrder]);
}

function usePendingCountSync() {
  const { sessionToken } = useAuth();
  const { setAvailablePendingCount, availableOrdersTabFocusedRef } = useOrders();

  const fetchCount = useCallback(async () => {
    if (availableOrdersTabFocusedRef.current) return;
    if (!getApiBase() || !sessionToken) return;
    try {
      const res = await fetch(`${getApiBase()}/api/technician/pending-orders?limit=50`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const json = await res.json() as { orders?: unknown[]; meta?: { total: number } };
        const count = json.meta?.total ?? (json.orders?.length ?? 0);
        if (!availableOrdersTabFocusedRef.current) {
          setAvailablePendingCount(count);
        }
      }
    } catch (_) {}
  }, [sessionToken, setAvailablePendingCount, availableOrdersTabFocusedRef]);

  useEffect(() => {
    fetchCount();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchCount();
    });
    return () => sub.remove();
  }, [fetchCount]);
}

function TechLayoutInner() {
  const { availablePendingCount, unreadCompletedCount } = useOrders();
  const { language, user, hasPendingToggle } = useApp();
  const profileSetupIncomplete = !user?.serviceCategories || user.serviceCategories.length === 0;
  const { isWsConnected } = useTechWs();
  const [adminNotification, setAdminNotification] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });
  const [cancelledNotification, setCancelledNotification] = useState<{ visible: boolean; key: number }>({
    visible: false,
    key: 0,
  });

  usePendingCountSync();
  useDemoOrderBroadcast();

  const handleAdminAvailabilityChange = useCallback(
    (isAvailable: boolean) => {
      const lang = language === "ar" ? "ar" : "en";
      const key = isAvailable ? "online" : "offline";
      const arMsg = ADMIN_AVAILABILITY_MESSAGES[key].ar;
      const enMsg = ADMIN_AVAILABILITY_MESSAGES[key].en;
      const message = lang === "ar" ? `${arMsg}\n${enMsg}` : `${enMsg}\n${arMsg}`;
      setAdminNotification({ message, visible: true });
    },
    [language],
  );

  useAdminAvailabilityNotification(handleAdminAvailabilityChange);

  const handleOrderCancelled = useCallback(() => {
    setCancelledNotification((prev) => ({ visible: true, key: prev.key + 1 }));
  }, []);

  useOrderCancelledNotification(handleOrderCancelled);

  const hideAdminNotification = useCallback(() => {
    setAdminNotification((prev) => ({ ...prev, visible: false }));
  }, []);

  const hideCancelledNotification = useCallback(() => {
    setCancelledNotification((prev) => ({ ...prev, visible: false }));
  }, []);

  const tabs = isLiquidGlassAvailable() ? <NativeTechTabs availablePendingCount={availablePendingCount} unreadCompletedCount={unreadCompletedCount} profileSetupIncomplete={profileSetupIncomplete} /> : <ClassicTechTabs />;

  const reconnectLabel = language === "ar" ? "جارٍ إعادة الاتصال…" : "Reconnecting…";
  const syncingLabel = language === "ar" ? "جارٍ المزامنة…" : "Syncing…";
  const cancelledMessage = language === "ar"
    ? `${ORDER_CANCELLED_MESSAGES.ar}\n${ORDER_CANCELLED_MESSAGES.en}`
    : `${ORDER_CANCELLED_MESSAGES.en}\n${ORDER_CANCELLED_MESSAGES.ar}`;

  const syncingTopOffset = !isWsConnected ? CONNECTION_BANNER_HEIGHT : 0;

  return (
    <>
      {tabs}
      
      {/* 👈 تم تصحيح الكود هنا لتضمين الخصائص الفعلية وإزالة رمز النقاط الثلاث */}
      {!isWsConnected && (
        <ConnectionBanner connected={isWsConnected} reconnectingLabel={reconnectLabel} />
      )}
      
      <SyncingBanner visible={hasPendingToggle} label={syncingLabel} topOffset={syncingTopOffset} />
      <Toast
        visible={adminNotification.visible}
        message={adminNotification.message}
        duration={6000}
        onHide={hideAdminNotification}
      />
      <Toast
        key={cancelledNotification.key}
        visible={cancelledNotification.visible}
        message={cancelledMessage}
        duration={5000}
        variant="error"
        onHide={hideCancelledNotification}
      />
    </>
  );
}

export default function TechLayout() {
  const { user, isOnline } = useApp();
  const { sessionToken } = useAuth();

  if (user?.type === "technician" && user?.isApproved === false) {
    return <Redirect href="/tech-pending" />;
  }

  return (
    <TechWsProvider user={user} sessionToken={sessionToken} isOnline={isOnline}>
      <TechLayoutInner />
    </TechWsProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 22 },
  dotBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  countBadge: {
    position: "absolute",
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  countBadgeWide: {
    minWidth: 24,
    borderRadius: 10,
  },
  countBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    lineHeight: 12,
  },
});