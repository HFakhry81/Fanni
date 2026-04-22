import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View, useColorScheme, Animated } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";

function PulsingBadge() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scaleAnim, opacityAnim]);

  return (
    <View style={styles.badgeWrapper}>
      <Animated.View
        style={[
          styles.badgePulseRing,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      />
      <View style={styles.badgeDot} />
    </View>
  );
}

function NativeTechTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="map">
        <Icon sf={{ default: "map", selected: "map.fill" }} />
        <Label>Map</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet.fill" }} />
        <Label>Orders</Label>
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
  const { t } = useApp();
  const { newPendingOrders } = useOrders();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const hasNew = newPendingOrders.length > 0;

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
          tabBarIcon: ({ color }) =>
            isIOS ? null : (
              <View>
                <Feather name="map" size={22} color={hasNew ? colors.primary : color} />
                {hasNew && <PulsingBadge />}
              </View>
            ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t("nav.orders"),
          tabBarIcon: ({ color }) => isIOS ? null : <Feather name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color }) => isIOS ? null : <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TechLayout() {
  const { newPendingOrders } = useOrders();
  const hasNew = newPendingOrders.length > 0;
  if (isLiquidGlassAvailable() && !hasNew) return <NativeTechTabs />;
  return <ClassicTechTabs />;
}

const styles = StyleSheet.create({
  badgeWrapper: {
    position: "absolute",
    top: -4,
    right: -6,
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgePulseRing: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
});
