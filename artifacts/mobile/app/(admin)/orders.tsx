import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";

export default function AdminOrdersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { allOrders } = useOrders();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>("all");

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const statusFilters = ["all", "pending", "accepted", "completed", "cancelled"];
  const filteredOrders = filter === "all" ? allOrders : allOrders.filter((o) => o.status === filter);

  const filterLabel = (f: string) => {
    if (f === "all") return isRTL ? "الكل" : "All";
    return t(`order.status.${f}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("admin.orders")}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
          {allOrders.length} {isRTL ? "طلب" : "orders"}
        </Text>
      </View>

      {/* Filter chips */}
      <View style={[styles.filterRow]}>
        <FlatList
          data={statusFilters}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === item ? colors.primary : colors.card,
                  borderColor: filter === item ? colors.primary : colors.border,
                  borderRadius: 20,
                },
              ]}
              onPress={() => setFilter(item)}
            >
              <Text
                style={{
                  color: filter === item ? "#FFF" : colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                }}
              >
                {filterLabel(item)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={[...filteredOrders].reverse()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={48} color={colors.border} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              {t("common.noData")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.orderCard,
              { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border },
            ]}
            onPress={() => router.push({ pathname: "/order-details", params: { orderId: item.id } })}
            activeOpacity={0.85}
          >
            <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                  {item.orderNumber}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                  {t(`cat.${item.category}`)} — {item.subCategory}
                </Text>
              </View>
              <StatusBadge status={item.status} />
            </View>
            <View style={[styles.cardMid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "العميل: " : "Client: "}{item.clientName}
                </Text>
                {item.technicianName && (
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? "الفني: " : "Tech: "}{item.technicianName}
                  </Text>
                )}
              </View>
              {item.invoice && (
                <View style={[styles.totalBadge, { backgroundColor: colors.accent, borderRadius: colors.radius }]}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                    {item.invoice.total.toFixed(0)} {t("common.egp")}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.cardFooter, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Feather name="calendar" size={12} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 }}>
                {item.visitDate} {item.visitTime}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 22 },
  filterRow: { paddingTop: 12 },
  filterList: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterChip: { paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1.5 },
  list: { paddingHorizontal: 16 },
  orderCard: { padding: 14, marginBottom: 10, borderWidth: 1.5 },
  cardTop: { alignItems: "flex-start", marginBottom: 8, gap: 8 },
  cardMid: { alignItems: "center", marginBottom: 6, gap: 8 },
  cardFooter: { alignItems: "center", gap: 4 },
  totalBadge: { paddingVertical: 6, paddingHorizontal: 12 },
  empty: { alignItems: "center", paddingTop: 80 },
});
