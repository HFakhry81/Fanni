import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";
import AppHeader from "@/components/AppHeader";

export default function AdminOrdersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { allOrders } = useOrders();
  const [filter, setFilter] = useState<string>("all");

  const statusFilters = ["all", "pending", "accepted", "completed", "cancelled"];
  const filteredOrders = filter === "all" ? allOrders : allOrders.filter((o) => o.status === filter);

  const filterColors: Record<string, string> = {
    all: colors.dark, pending: colors.primary, accepted: colors.secondary,
    completed: colors.success, cancelled: colors.destructive,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.orders")}
        subtitle={`${allOrders.length} ${isRTL ? "طلب" : "orders"}`}
        showHome
        showLogout
      />

      {/* Filter chips */}
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

      <FlatList
        data={[...filteredOrders].reverse()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <VectorIcon name="inbox" size={48} color={colors.border} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>{t("common.noData")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: "/order-details", params: { orderId: item.id } })}
            activeOpacity={0.85}
          >
            <View style={[styles.accentBar, { backgroundColor: filterColors[item.status] ?? colors.secondary }]} />
            <View style={styles.cardBody}>
              <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>{item.orderNumber}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                    {t(`cat.${item.category}`)} — {item.subCategory}
                  </Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              <View style={[styles.cardMid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? "👤 " : "👤 "}{item.clientName}
                  </Text>
                  {item.technicianName && (
                    <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                      🔧 {item.technicianName}
                    </Text>
                  )}
                </View>
                {item.invoice && (
                  <View style={[styles.totalChip, { backgroundColor: colors.accent, borderRadius: 10 }]}>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{item.invoice.total.toFixed(0)}</Text>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_400Regular", fontSize: 11 }}> {t("common.egp")}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.cardFoot, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <VectorIcon name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 }}>{item.visitDate} {item.visitTime}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { paddingTop: 10 },
  filterList: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1.5 },
  list: { paddingHorizontal: 16 },
  card: { marginBottom: 10, borderWidth: 1.5, flexDirection: "row", overflow: "hidden" },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { alignItems: "flex-start", marginBottom: 8, gap: 8 },
  cardMid: { alignItems: "center", marginBottom: 6, gap: 8 },
  cardFoot: { alignItems: "center", gap: 4 },
  totalChip: { paddingVertical: 6, paddingHorizontal: 12 },
  empty: { alignItems: "center", paddingTop: 80 },
});
