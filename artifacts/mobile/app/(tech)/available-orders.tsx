import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/context/OrderContext";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import AppHeader from "@/components/AppHeader";
import FanniButton from "@/components/FanniButton";
import { useRouter } from "expo-router";

function getApiBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

const CATEGORY_ICONS: Record<string, string> = {
  electricity: "zap",
  plumbing: "droplet",
  ac: "wind",
  carpentry: "tool",
  appliances: "cpu",
  painting: "edit-3",
  pest: "alert-triangle",
  flooring: "grid",
};

interface PendingOrder {
  id: string;
  orderNumber: string;
  orderSerial: number;
  category: string;
  subCategory: string | null;
  governorate: string | null;
  area: string | null;
  street: string | null;
  floor: string | null;
  building: string | null;
  visitDate: string | null;
  visitTime: string | null;
  problemDescription: string | null;
  deviceType: string | null;
  createdAt: string;
}

export default function AvailableOrdersScreen() {
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { sessionToken } = useAuth();
  const { updateOrder, setAvailablePendingCount } = useOrders();
  const router = useRouter();

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (isRefresh = false, silent = false) => {
    const apiBase = getApiBaseUrl();
    if (!apiBase || !sessionToken) {
      setOrders([]);
      setAvailablePendingCount(0);
      return;
    }
    let didSetLoading = false;
    let didSetRefreshing = false;
    if (!silent) {
      if (isRefresh) {
        setRefreshing(true);
        didSetRefreshing = true;
      } else {
        setLoading(true);
        didSetLoading = true;
      }
    }
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/technician/pending-orders?limit=50`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { orders: PendingOrder[]; meta?: { total: number } };
      const fetched = json.orders ?? [];
      setOrders(fetched);
      setAvailablePendingCount(json.meta?.total ?? fetched.length);
    } catch (err) {
      console.warn("[Fanni] Failed to fetch pending orders:", err);
      setError(isRTL ? "تعذّر تحميل الطلبات المتاحة" : "Could not load available orders");
    } finally {
      if (didSetLoading) setLoading(false);
      if (didSetRefreshing) setRefreshing(false);
    }
  }, [sessionToken, isRTL]);

  const isFocusedRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      fetchOrders();
      pollTimerRef.current = setInterval(() => {
        if (isFocusedRef.current) {
          fetchOrders(false, true);
        }
      }, 60_000);
      return () => {
        isFocusedRef.current = false;
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };
    }, [fetchOrders])
  );

  const silentFetchRef = useRef<() => void>(() => {});
  silentFetchRef.current = () => {
    if (isFocusedRef.current) {
      fetchOrders(false, true);
    }
  };

  const onNewOrderCallback = useCallback(() => {
    silentFetchRef.current();
  }, []);

  useOrderNotifications(true, user, sessionToken, onNewOrderCallback);

  const handleAccept = async (order: PendingOrder) => {
    setAcceptingId(order.id);
    try {
      const apiBase = getApiBaseUrl();
      if (apiBase && sessionToken) {
        const res = await fetch(`${apiBase}/api/orders/${order.id}/acknowledge`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            technicianName: user?.name ?? "",
            technicianMobile: user?.mobile ?? "",
            technicianAvatar: user?.avatar,
            technicianRating: 4.8,
          }),
        });
        if (res.ok) {
          await updateOrder(order.id, {
            status: "accepted",
            technicianId: user?.id ?? "",
            technicianName: user?.name ?? "",
            technicianMobile: user?.mobile ?? "",
            technicianAvatar: user?.avatar,
            technicianRating: 4.8,
          });
          setOrders((prev) => {
            const next = prev.filter((o) => o.id !== order.id);
            setAvailablePendingCount(next.length);
            return next;
          });
          router.push("/(tech)/orders");
        } else {
          console.warn("[Fanni] Acknowledge failed:", res.status);
        }
      }
    } catch (err) {
      console.warn("[Fanni] Accept error:", err);
    } finally {
      setAcceptingId(null);
    }
  };

  const renderItem = ({ item }: { item: PendingOrder }) => {
    const iconName = (CATEGORY_ICONS[item.category] ?? "tool") as string;
    const isAccepting = acceptingId === item.id;
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={[styles.cardAccent, { backgroundColor: colors.primary }]} />
        <View style={styles.cardBody}>
          <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.categoryIcon, { backgroundColor: colors.primary + "18" }]}>
              <VectorIcon name={iconName} size={18} color={colors.primary} />
            </View>
            <View style={[styles.cardHeaderText, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 14,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {item.orderNumber}
              </Text>
              <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                {t(`cat.${item.category}`)}
                {item.subCategory ? ` — ${item.subCategory}` : ""}
              </Text>
            </View>
          </View>

          {item.problemDescription ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                marginTop: 8,
                textAlign: isRTL ? "right" : "left",
              }}
              numberOfLines={2}
            >
              {item.problemDescription}
            </Text>
          ) : null}

          <View style={[styles.metaRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <VectorIcon name="map-pin" size={12} color={colors.secondary} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                marginLeft: isRTL ? 0 : 5,
                marginRight: isRTL ? 5 : 0,
                flex: 1,
                textAlign: isRTL ? "right" : "left",
              }}
              numberOfLines={1}
            >
              {[item.area, item.street].filter(Boolean).join(", ") || (isRTL ? "غير محدد" : "Unknown")}
            </Text>
          </View>

          {item.visitDate ? (
            <View style={[styles.metaRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <VectorIcon name="calendar" size={12} color={colors.secondary} />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  marginLeft: isRTL ? 0 : 5,
                  marginRight: isRTL ? 5 : 0,
                }}
              >
                {item.visitDate} {item.visitTime ?? ""}
              </Text>
            </View>
          ) : null}

          <FanniButton
            title={isRTL ? "قبول الطلب" : "Accept Order"}
            onPress={() => handleAccept(item)}
            loading={isAccepting}
            style={{ marginTop: 12 }}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "الطلبات المتاحة" : "Available Orders"}
        subtitle={
          orders.length > 0
            ? isRTL
              ? `${orders.length} طلب في منطقتك`
              : `${orders.length} order${orders.length !== 1 ? "s" : ""} in your area`
            : undefined
        }
        showLangToggle
      />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 12 }}>
            {isRTL ? "جارٍ التحميل…" : "Loading…"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {error ? (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: "#FEF2F2" }]}>
                    <VectorIcon name="alert-circle" size={32} color="#EF4444" />
                  </View>
                  <Text style={{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 12, textAlign: "center" }}>
                    {error}
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { borderColor: colors.primary }]}
                    onPress={() => fetchOrders()}
                  >
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {isRTL ? "إعادة المحاولة" : "Retry"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                    <VectorIcon name="inbox" size={32} color={colors.mutedForeground} />
                  </View>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16, marginTop: 14, textAlign: "center" }}>
                    {isRTL ? "لا توجد طلبات متاحة" : "No Available Orders"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6, textAlign: "center", maxWidth: 260 }}>
                    {isRTL
                      ? "ستظهر هنا الطلبات المفتوحة في منطقتك وتخصصك عند ورودها"
                      : "Open orders in your area and category will appear here when they arrive"}
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { borderColor: colors.primary, marginTop: 20 }]}
                    onPress={() => fetchOrders()}
                  >
                    <VectorIcon name="refresh-cw" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {isRTL ? "تحديث" : "Refresh"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "web" ? 100 : 90,
    gap: 12,
  },
  card: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1.5,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: { alignItems: "flex-start", gap: 10 },
  cardHeaderText: { flex: 1 },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: { alignItems: "center", marginTop: 6 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 12,
  },
});
