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
import { useOrders, Order } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";

export default function ClientOrdersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { getOrdersByClient } = useOrders();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"active" | "history">("active");

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const orders = getOrdersByClient(user?.id ?? "client1");
  const activeOrders = orders.filter((o) =>
    ["pending", "accepted", "inProgress"].includes(o.status)
  );
  const historyOrders = orders.filter((o) =>
    ["completed", "cancelled"].includes(o.status)
  );

  const displayOrders = tab === "active" ? activeOrders : historyOrders;

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={[
        styles.orderCard,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
      onPress={() =>
        router.push({ pathname: "/order-details", params: { orderId: item.id } })
      }
      activeOpacity={0.85}
    >
      <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              fontSize: 15,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {item.orderNumber}
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              marginTop: 2,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {t(`cat.${item.category}`)} — {item.subCategory}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={[styles.cardInfo, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Feather name="map-pin" size={13} color={colors.mutedForeground} />
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            marginLeft: isRTL ? 0 : 4,
            marginRight: isRTL ? 4 : 0,
          }}
        >
          {item.street}, {t("order.floor")} {item.floor}
        </Text>
      </View>

      <View style={[styles.cardInfo, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Feather name="calendar" size={13} color={colors.mutedForeground} />
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            marginLeft: isRTL ? 0 : 4,
            marginRight: isRTL ? 4 : 0,
          }}
        >
          {item.visitDate} — {item.visitTime}
        </Text>
      </View>

      {item.technicianName && (
        <View style={[styles.techRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View
            style={[
              styles.techAvatar,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 12 }}>
              {item.technicianName[0]}
            </Text>
          </View>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              marginLeft: isRTL ? 0 : 6,
              marginRight: isRTL ? 6 : 0,
            }}
          >
            {item.technicianName}
          </Text>
          {item.technicianRating && (
            <View style={[styles.ratingBadge, { backgroundColor: colors.accent, borderRadius: 8 }]}>
              <Feather name="star" size={11} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 3 }}>
                {item.technicianRating}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("nav.orders")}
        </Text>
        <TouchableOpacity
          style={[styles.newOrderBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          onPress={() => router.push("/(client)/home")}
        >
          <Feather name="plus" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {([["active", t("order.active")], ["history", t("order.history")]] as [string, string][]).map(
          ([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: tab === key ? colors.primary : "transparent",
                  borderRadius: colors.radius,
                },
              ]}
              onPress={() => setTab(key as "active" | "history")}
            >
              <Text
                style={{
                  color: tab === key ? "#FFF" : colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <FlatList
        data={displayOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 100 : 90 },
        ]}
        scrollEnabled={displayOrders.length > 0}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color={colors.border} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, marginTop: 12, textAlign: "center" }}>
              {t("common.noData")}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22 },
  newOrderBtn: { padding: 10 },
  tabRow: {
    margin: 12,
    padding: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  orderCard: {
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  cardInfo: {
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  techRow: {
    alignItems: "center",
    marginTop: 10,
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  techAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginLeft: "auto",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
  },
});
