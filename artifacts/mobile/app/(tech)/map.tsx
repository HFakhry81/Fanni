import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders, Order } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";
import FanniButton from "@/components/FanniButton";

export default function TechMapScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { allOrders, updateOrder } = useOrders();
  const insets = useSafeAreaInsets();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  // Pending orders in tech's specialty area
  const pendingOrders = allOrders.filter((o) => o.status === "pending");

  const handleOrderTap = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const handleAccept = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    await updateOrder(selectedOrder.id, {
      status: "accepted",
      technicianId: user?.id ?? "tech1",
      technicianName: user?.name ?? "محمد علي",
      technicianMobile: user?.mobile ?? "01098765432",
      technicianRating: 4.8,
    });
    setLoading(false);
    setModalVisible(false);
    setSelectedOrder(null);
    router.push("/(tech)/orders");
  };

  const handleReject = () => {
    setModalVisible(false);
    setSelectedOrder(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "منطقة الخدمة" : "Service Area"}
          </Text>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18, textAlign: isRTL ? "right" : "left" }}>
            {user?.name}
          </Text>
        </View>
        <View style={[styles.onlineBadge, { backgroundColor: colors.success }]}>
          <View style={[styles.onlineDot, { backgroundColor: "#FFF" }]} />
          <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
            {isRTL ? "متاح" : "Online"}
          </Text>
        </View>
      </View>

      {/* Map placeholder */}
      <View style={[styles.mapPlaceholder, { backgroundColor: "#E8F4FD" }]}>
        <Feather name="map" size={48} color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15, marginTop: 12, textAlign: "center" }}>
          {isRTL ? "خريطة منطقة الخدمة" : "Service Area Map"}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4, textAlign: "center" }}>
          {isRTL ? "الطلبات المتاحة في منطقتك" : "Available orders in your area"}
        </Text>
        {/* Map pins for pending orders */}
        {pendingOrders.slice(0, 3).map((order, i) => (
          <TouchableOpacity
            key={order.id}
            style={[
              styles.mapPin,
              {
                backgroundColor: colors.primary,
                top: 40 + i * 60,
                left: 60 + i * 80,
              },
            ]}
            onPress={() => handleOrderTap(order)}
          >
            <Feather name="map-pin" size={16} color="#FFF" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Pending orders list */}
      <View style={[styles.ordersSection, { backgroundColor: colors.background }]}>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 16,
            paddingHorizontal: 16,
            paddingTop: 16,
            marginBottom: 8,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {isRTL ? `الطلبات المتاحة (${pendingOrders.length})` : `Available Orders (${pendingOrders.length})`}
        </Text>
        <FlatList
          data={pendingOrders}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ListEmptyComponent={
            <View style={styles.emptyHoriz}>
              <Feather name="inbox" size={32} color={colors.border} />
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                {t("common.noData")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.pendingCard,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleOrderTap(item)}
              activeOpacity={0.85}
            >
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 4, textAlign: isRTL ? "right" : "left" }}>
                {item.orderNumber}
              </Text>
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
                {t(`cat.${item.category}`)}
              </Text>
              <View style={[styles.cardRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4 }} numberOfLines={1}>
                  {item.street}
                </Text>
              </View>
              <View style={[styles.cardRow, { flexDirection: isRTL ? "row-reverse" : "row", marginBottom: 10 }]}>
                <Feather name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4 }}>
                  {item.visitDate}
                </Text>
              </View>
              <View style={[styles.orderBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  style={[styles.acceptBtn, { backgroundColor: colors.primary, borderRadius: colors.radius / 2, flex: 1 }]}
                  onPress={() => { setSelectedOrder(item); handleAccept(); }}
                >
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{t("tech.accept")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, { borderColor: colors.border, borderRadius: colors.radius / 2, flex: 1 }]}
                  onPress={() => {}}
                >
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{t("tech.reject")}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: isRTL ? "right" : "left", marginBottom: 8 }}>
              {t("tech.newOrder")}
            </Text>
            {selectedOrder && (
              <>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
                  {selectedOrder.orderNumber}
                </Text>
                <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 14, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>
                  {t(`cat.${selectedOrder.category}`)} — {selectedOrder.subCategory}
                </Text>
                {[
                  [t("order.problemDesc"), selectedOrder.problemDescription],
                  [t("order.visitDate"), selectedOrder.visitDate + " " + selectedOrder.visitTime],
                  [isRTL ? "العنوان" : "Address", `${selectedOrder.street}, ${t("order.floor")} ${selectedOrder.floor}`],
                  [t("order.deviceType"), selectedOrder.deviceType || "—"],
                ].map(([label, value]) => (
                  <View key={label} style={[styles.modalRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>{label}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 2, textAlign: isRTL ? "left" : "right" }} numberOfLines={2}>{value}</Text>
                  </View>
                ))}
                <View style={[styles.modalBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <FanniButton
                    title={t("tech.reject")}
                    onPress={handleReject}
                    variant="outline"
                    style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
                  />
                  <FanniButton
                    title={t("tech.accept")}
                    onPress={handleAccept}
                    loading={loading}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  mapPlaceholder: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  mapPin: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  ordersSection: { flex: 1 },
  horizontalList: { paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 100 : 90 },
  pendingCard: {
    width: 220,
    marginRight: 12,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardRow: { alignItems: "center", marginBottom: 4, gap: 4 },
  orderBtns: { gap: 8 },
  acceptBtn: { paddingVertical: 8, alignItems: "center" },
  rejectBtn: { paddingVertical: 8, alignItems: "center", borderWidth: 1.5, backgroundColor: "transparent" },
  emptyHoriz: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingVertical: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { padding: 24, margin: 16, marginBottom: 24 },
  modalRow: { paddingVertical: 10, borderBottomWidth: 1 },
  modalBtns: { marginTop: 20, gap: 8 },
});
