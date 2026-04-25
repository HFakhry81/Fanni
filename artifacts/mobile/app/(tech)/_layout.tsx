import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React, { useCallback, useEffect, useRef } from "react";
import { AppState, Platform, StyleSheet, View, Text, useColorScheme, Animated } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/context/OrderContext";

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

function NativeTechTabs() {
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
        <Icon sf={{ default: "list.bullet", selected: "list.bullet.fill" }} />
        <Label>Orders</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="invoices">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>Invoices</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTechTabs() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { availablePendingCount } = useOrders();
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
          tabBarIcon: () =>
            isIOS ? null : (
              <View>
                <Text style={styles.tabIcon}>📥</Text>
                {availablePendingCount > 0 && <CountBadge count={availablePendingCount} />}
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("nav.orders"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>📋</Text>,
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
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

function usePendingCountSync() {
  const { sessionToken } = useAuth();
  const { setAvailablePendingCount } = useOrders();

  const fetchCount = useCallback(async () => {
    const domain = process.env["EXPO_PUBLIC_DOMAIN"];
    if (!domain || !sessionToken) return;
    try {
      const res = await fetch(`https://${domain}/api/technician/pending-orders?limit=50`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const json = await res.json() as { orders?: unknown[]; meta?: { total: number } };
        const count = json.meta?.total ?? (json.orders?.length ?? 0);
        setAvailablePendingCount(count);
      }
    } catch (_) {}
  }, [sessionToken, setAvailablePendingCount]);

  useEffect(() => {
    fetchCount();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchCount();
    });
    return () => sub.remove();
  }, [fetchCount]);
}

export default function TechLayout() {
  const { availablePendingCount } = useOrders();
  usePendingCountSync();
  if (isLiquidGlassAvailable() && availablePendingCount === 0) return <NativeTechTabs />;
  return <ClassicTechTabs />;
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 22 },
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
