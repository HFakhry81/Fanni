import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform, StyleSheet, View, Text, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

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
        name="profile"
        options={{
          title: t("admin.profile"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

export default function AdminTabsLayout() {
  if (isLiquidGlassAvailable()) return <NativeAdminTabs />;
  return <ClassicAdminTabs />;
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 22 },
});
