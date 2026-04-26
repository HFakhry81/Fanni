import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Platform, StyleSheet, View, Text, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useClientOrderUpdates, OrderStatusNotification } from "@/hooks/useClientOrderUpdates";
import Toast from "@/components/Toast";

interface QueuedNotification {
  orderId: string;
  message: string;
}

function ClientOrderUpdatesListener({
  onNotification,
}: {
  onNotification: (n: OrderStatusNotification) => void;
}) {
  const { user } = useApp();
  const { sessionToken } = useAuth();
  useClientOrderUpdates(user, sessionToken, onNotification);
  return null;
}

function NativeClientTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
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

function ClassicClientTabs() {
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
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("nav.home"),
          tabBarIcon: () => isIOS ? null : <Text style={styles.tabIcon}>🏠</Text>,
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

const STATUS_MESSAGES: Record<string, { ar: string; en: string }> = {
  accepted: {
    ar: "تم قبول طلبك",
    en: "Your order has been accepted!",
  },
  inProgress: {
    ar: "الفني في الطريق إليك",
    en: "Your technician is on the way!",
  },
  completed: {
    ar: "تم إتمام طلبك بنجاح",
    en: "Your order is complete!",
  },
};

export default function ClientLayout() {
  const router = useRouter();
  const { language } = useApp();

  const queueRef = useRef<QueuedNotification[]>([]);
  const [current, setCurrent] = useState<QueuedNotification | null>(null);
  const currentRef = useRef<QueuedNotification | null>(null);
  const isTransitioningRef = useRef(false);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNext = useCallback(() => {
    isTransitioningRef.current = false;
    const next = queueRef.current.shift() ?? null;
    currentRef.current = next;
    setCurrent(next);
  }, []);

  useEffect(() => {
    return () => {
      if (nextTimerRef.current) {
        clearTimeout(nextTimerRef.current);
      }
    };
  }, []);

  const handleNotification = useCallback(
    (n: OrderStatusNotification) => {
      const lang = language === "ar" ? "ar" : "en";
      const statusMsg = STATUS_MESSAGES[n.status]?.[lang] ?? n.status;
      const orderLabel = lang === "ar" ? `طلب ${n.orderNumber}` : `Order ${n.orderNumber}`;
      const message = `${orderLabel} — ${statusMsg}`;
      const queued: QueuedNotification = { orderId: n.orderId, message };

      if (currentRef.current === null && !isTransitioningRef.current) {
        currentRef.current = queued;
        setCurrent(queued);
      } else {
        queueRef.current.push(queued);
      }
    },
    [language]
  );

  const hideNotification = useCallback(() => {
    currentRef.current = null;
    isTransitioningRef.current = true;
    setCurrent(null);
    if (nextTimerRef.current) {
      clearTimeout(nextTimerRef.current);
    }
    nextTimerRef.current = setTimeout(showNext, 300);
  }, [showNext]);

  const goToOrder = useCallback(() => {
    if (current?.orderId) {
      router.push({ pathname: "/order-details", params: { orderId: current.orderId } });
    }
  }, [current?.orderId, router]);

  return (
    <>
      <ClientOrderUpdatesListener onNotification={handleNotification} />
      {isLiquidGlassAvailable() ? <NativeClientTabs /> : <ClassicClientTabs />}
      <Toast
        visible={current !== null}
        message={current?.message ?? ""}
        duration={5000}
        onHide={hideNotification}
        onPress={goToOrder}
        action={{ label: language === "ar" ? "عرض" : "View", onPress: goToOrder }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 22 },
});
