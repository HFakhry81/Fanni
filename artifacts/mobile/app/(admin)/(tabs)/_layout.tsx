import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import VectorIcon from "@/components/VectorIcon";

// ─── Native tabs (iOS 26 Liquid Glass) ──────────────────────────────────────
function NativeAdminTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="users">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>Users</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="categories">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Categories</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet" }} />
        <Label>Orders</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ledger">
        <Icon sf={{ default: "book.closed", selected: "book.closed.fill" }} />
        <Label>Ledger</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="permissions">
        <Icon sf={{ default: "shield", selected: "shield.fill" }} />
        <Label>Admins</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Stats</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// ─── Classic tabs (Android / web / older iOS) ────────────────────────────────
function ClassicAdminTabs() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const tabScreenOptions = {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.mutedForeground,
    headerShown: false,
    tabBarStyle: {
      position: "absolute" as const,
      backgroundColor: isIOS ? "transparent" : colors.card,
      borderTopWidth: isWeb ? 1 : 0,
      borderTopColor: colors.border,
      elevation: 0,
      ...(isWeb ? { height: 64 } : {}),
    },
    tabBarLabelStyle: {
      fontFamily: "Inter_500Medium",
      fontSize: 10,
    },
    tabBarBackground: () =>
      isIOS ? (
        <BlurView
          intensity={100}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : isWeb ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
      ) : null,
  };

  return (
    <Tabs initialRouteName="profile" screenOptions={tabScreenOptions}>
      {/* ── Visible tabs ── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: isRTL ? "الملف الشخصي" : "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? null : <VectorIcon name="user" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: isRTL ? "المستخدمون" : "Users",
          tabBarIcon: ({ color }) =>
            isIOS ? null : <VectorIcon name="users" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: isRTL ? "الفئات" : "Categories",
          tabBarIcon: ({ color }) =>
            isIOS ? null : <VectorIcon name="grid" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: isRTL ? "الطلبات" : "Orders",
          tabBarIcon: ({ color }) =>
            isIOS ? null : <VectorIcon name="list" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: isRTL ? "الأستاذ" : "Ledger",
          tabBarIcon: ({ color }) =>
            isIOS ? null : <VectorIcon name="book-open" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="permissions"
        options={{
          title: isRTL ? "المسئولون" : "Admins",
          tabBarIcon: ({ color }) =>
            isIOS ? null : <VectorIcon name="shield" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: isRTL ? "الإحصائيات" : "Stats",
          tabBarIcon: ({ color }) =>
            isIOS ? null : <VectorIcon name="bar-chart-2" size={20} color={color} />,
        }}
      />

      {/* ── Hidden screens (navigable but not in tab bar) ── */}
      <Tabs.Screen name="dashboard"        options={{ href: null }} />
      <Tabs.Screen name="pending"          options={{ href: null }} />
      <Tabs.Screen name="login-logs"       options={{ href: null }} />
      <Tabs.Screen name="map-dashboard"    options={{ href: null }} />
      <Tabs.Screen name="missed-locations" options={{ href: null }} />
    </Tabs>
  );
}

// ─── Main layout ─────────────────────────────────────────────────────────────
export default function AdminTabsLayout() {
  const { user } = useAuth();
  const { t, isRTL } = useApp();
  const colors = useColors();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showBanner = !bannerDismissed && user?.mustChangePassword === true;

  return (
    <View style={styles.root}>
      {showBanner && (
        <View
          style={[
            styles.banner,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          <VectorIcon name="alert-triangle" size={16} color="#C8880A" style={{ marginTop: 1 }} />
          <View
            style={{
              flex: 1,
              marginLeft: isRTL ? 0 : 8,
              marginRight: isRTL ? 8 : 0,
            }}
          >
            <Text
              style={[styles.bannerText, { textAlign: isRTL ? "right" : "left" }]}
            >
              {t("admin.defaultPasswordBanner")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setBannerDismissed(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <VectorIcon name="x" size={16} color="#C8880A" />
          </TouchableOpacity>
        </View>
      )}

      {isLiquidGlassAvailable() ? <NativeAdminTabs /> : <ClassicAdminTabs />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    backgroundColor: "#FFF3CD",
    borderBottomWidth: 1.5,
    borderBottomColor: "#F5A623",
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    gap: 8,
    zIndex: 10,
  },
  bannerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#7A5200",
    lineHeight: 17,
  },
});
