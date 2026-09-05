import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import AppHeader from "@/components/AppHeader";
import { getApiBase } from "@/utils/api";
import { formatVisitDateDisplay, formatCreatedAtDisplay } from "@/utils/dateDisplay";

type AdminOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  dbStatus?: string;
  category?: string | null;
  subCategory?: string | null;
  clientName?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  visitDate?: string | null;
  visitTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export default function AdminOrdersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const qs = filter !== "all" ? `?status=${encodeURIComponent(filter)}&limit=100` : "?limit=100";
      const res = await fetch(`${apiBase}/api/admin/orders${qs}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        setError(isRTL ? "تعذر تحميل الطلبات من الخادم" : "Failed to load orders from server");
        return;
      }
      const json = (await res.json()) as { orders?: AdminOrderRow[] };
      setOrders(json.orders ?? []);
    } catch {
      setError(isRTL ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, filter, isRTL]);

  useFocusEffect(
    useCallback(() => {
      void fetchOrders();
    }, [fetchOrders]),
  );

  const statusFilters = ["all", "pending", "accepted", "inProgress", "completed", "cancelled"];

  const filterColors: Record<string, string> = {
    all: colors.dark,
    pending: colors.primary,
    accepted: colors.secondary,
    inProgress: "#6C4FBB",
    completed: colors.success,
    cancelled: colors.destructive,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.orders")}
        subtitle={
          isRTL
            ? `${orders.length} طلب (مباشر من الخادم)`
            : `${orders.length} orders (live from server)`
        }
        showHome
        showLogout
        rightElement={
          <TouchableOpacity onPress={() => void fetchOrders(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <VectorIcon name="refresh-cw" size={18} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.filterRow}>
        <FlatList
          data={statusFilters}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = filter === item;
            const chipColor = filterColors[item] ?? colors.dark;
            return (
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? chipColor : colors.card,
                    borderColor: isActive ? chipColor : colors.border,
                    borderRadius: 20,
                  },
                ]}
                onPress={() => setFilter(item)}
              >
                <Text style={{ color: isActive ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  {item === "all" ? (isRTL ? "الكل" : "All") : t(`order.status.${item}`)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void fetchOrders(true)} tintColor={colors.primary} />
          }
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <VectorIcon name="inbox" size={48} color={colors.border} />
              <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>
                {error ?? t("common.noData")}
              </Text>
              {error ? (
                <TouchableOpacity onPress={() => void fetchOrders(true)} style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>{isRTL ? "إعادة المحاولة" : "Retry"}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <View style={[styles.accentBar, { backgroundColor: filterColors[item.status] ?? colors.secondary }]} />
              <View style={styles.cardBody}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/order-details", params: { orderId: item.id } })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                        {item.orderNumber}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                        {item.category ? t(`cat.${item.category}`) : ""}{item.subCategory ? ` — ${item.subCategory}` : ""}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <View style={[styles.cardMid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <View style={{ flex: 1 }}>
                      {item.clientName ? (
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                          {item.clientName}
                        </Text>
                      ) : null}
                      {item.technicianName ? (
                        <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                          {item.technicianName}
                        </Text>
                      ) : item.status === "accepted" || item.status === "inProgress" ? (
                        <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: isRTL ? "right" : "left" }}>
                          {isRTL ? "فني معيَّن (بدون اسم محفوظ)" : "Technician assigned (name missing)"}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={[styles.cardFoot, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <VectorIcon name="calendar" size={12} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 }}>
                      {formatVisitDateDisplay(item.visitDate, isRTL) || formatCreatedAtDisplay(item.createdAt, isRTL)}
                      {item.visitTime ? ` ${item.visitTime}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { paddingVertical: 8 },
  filterList: { paddingHorizontal: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, marginRight: 8 },
  list: { padding: 12, gap: 10 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  card: { borderWidth: 1, overflow: "hidden", flexDirection: "row", marginBottom: 10 },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { alignItems: "flex-start", gap: 8, marginBottom: 8 },
  cardMid: { marginBottom: 6 },
  cardFoot: { alignItems: "center", marginTop: 4 },
});
