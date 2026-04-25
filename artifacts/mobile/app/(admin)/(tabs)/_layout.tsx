import { Tabs, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React, { useState } from "react";
import { Platform, StyleSheet, View, Text, TouchableOpacity, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import VectorIcon from "@/components/VectorIcon";

function NativeAdminTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="dashboard">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="users">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>Users</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet.fill" }} />
        <Label>Orders</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Stats</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="permissions">
        <Icon sf={{ default: "shield", selected: "shield.fill" }} />
        <Label>Permissions</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="login-logs">
        <Icon sf={{ default: "list.bullet.clipboard", selected: "list.bullet.clipboard.fill" }} />
        <Label>Logs</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicAdminTabs() {
  const colors = useColors();
  const { t } = useApp();
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
        name="dashboard"
        options={{
          title: t("admin.dashboard"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>🗂️</Text>,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: t("admin.users"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("admin.orders"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t("admin.stats"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>📈</Text>,
        }}
      />
      <Tabs.Screen
        name="permissions"
        options={{
          title: t("admin.permissions"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>🛡️</Text>,
        }}
      />
      <Tabs.Screen
        name="login-logs"
        options={{
          title: t("loginLogs.title"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>📋</Text>,
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

export default function AdminTabsLayout() {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { user } = useAuth();
  const { t, isRTL } = useApp();
  const router = useRouter();
  const colors = useColors();

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
          <VectorIcon name="alert-triangle" size={18} color="#C8880A" style={{ marginTop: 1 }} />
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
            <Text style={[styles.bannerText, { textAlign: isRTL ? "right" : "left" }]}>
              {t("admin.defaultPasswordBanner")}
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: "/(admin)/(tabs)/profile", params: { mode: "change-password" } })
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.bannerLink, { textAlign: isRTL ? "right" : "left" }]}>
                {t("admin.changePasswordNow")} →
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setBannerDismissed(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <VectorIcon name="x" size={18} color="#C8880A" />
          </TouchableOpacity>
        </View>
      )}
      {isLiquidGlassAvailable() ? <NativeAdminTabs /> : <ClassicAdminTabs />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabIcon: { fontSize: 22 },
  banner: {
    backgroundColor: "#FFF3CD",
    borderBottomWidth: 1.5,
    borderBottomColor: "#F5A623",
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "flex-start",
    gap: 4,
    zIndex: 10,
  },
  bannerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#7A5200",
    lineHeight: 18,
  },
  bannerLink: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#C8880A",
    marginTop: 4,
  },
});
