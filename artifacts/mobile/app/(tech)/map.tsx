import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders, Order } from "@/context/OrderContext";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import StatusBadge from "@/components/StatusBadge";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";

export default function TechMapScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { allOrders, updateOrder, newPendingOrders, markOrderSeen } = useOrders();
  const insets = useSafeAreaInsets();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const autoShownRef = useRef<Set<string>>(new Set());

  useOrderNotifications();

  const pendingOrders = allOrders.filter((o) => o.status === "pending");

  useEffect(() => {
    if (newPendingOrders.length === 0) return;
    const unshown = newPendingOrders.filter((o) => !autoShownRef.current.has(o.id));
    if (unshown.length === 0) return;
    if (modalVisible) return;
    const order = unshown[0];
    autoShownRef.current.add(order.id);
    setSelectedOrder(order);
    setModalVisible(true);
  }, [newPendingOrders, modalVisible]);

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
    if (selectedOrder) markOrderSeen(selectedOrder.id);
    setSelectedOrder(null);
    router.push("/(tech)/orders");
  };

  const handleReject = () => {
    if (selectedOrder) {
      autoShownRef.current.add(selectedOrder.id);
      markOrderSeen(selectedOrder.id);
    }
    setModalVisible(false);
    setSelectedOrder(null);
  };

  const handleOpenOrder = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={user?.name ?? t("app.name")}
        subtitle={isRTL ? "منطقة الخدمة" : "Service Area"}
        showLangToggle
        rightElement={
          <View style={[styles.onlineBadge, { backgroundColor: "#22A36B" }]}>
            <View style={styles.onlineDot} />
            <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
              {isRTL ? "متاح" : "Online"}
            </Text>
          </View>
        }
      />

      {/* Map placeholder – Egypt / Alexandria focused */}
      <View style={[styles.mapPlaceholder, { backgroundColor: colors.accentBlue }]}>
        {/* Street grid overlay simulating a city map */}
        <View style={styles.mapGrid}>
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3, 4].map((col) => (
              <View key={`${row}-${col}`} style={[styles.mapCell, { borderColor: colors.secondary + "25" }]} />
            ))
          )}
        </View>

        {/* "Sea" band at the top to simulate Mediterranean */}
        <View style={[styles.seaBand, { backgroundColor: colors.secondary + "40" }]}>
          <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1 }}>
            {isRTL ? "البحر الأبيض المتوسط" : "MEDITERRANEAN SEA"}
          </Text>
        </View>

        {/* Alexandria label */}
        <View style={styles.cityLabel}>
          <View style={[styles.cityDot, { backgroundColor: colors.primary }]} />
          <Text style={{ color: colors.dark, fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {isRTL ? "الإسكندرية" : "Alexandria"}
          </Text>
          <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 10, marginTop: 1 }}>
            31.2001° N, 29.9187° E
          </Text>
        </View>

        {/* District labels */}
        {[
          { label: isRTL ? "سيدي بشر" : "Sidi Bishr", top: 90, left: "60%" },
          { label: isRTL ? "المنتزه" : "Montaza",    top: 60,  left: "72%" },
          { label: isRTL ? "فلمنج"   : "Fleming",    top: 100, left: "40%" },
          { label: isRTL ? "الجمرك"  : "Gomrok",     top: 85,  left: "15%" },
        ].map((d) => (
          <View key={d.label} style={[styles.districtTag, { top: d.top, left: d.left as any, backgroundColor: colors.card + "DD" }]}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 9 }}>{d.label}</Text>
          </View>
        ))}

        {/* Order pins */}
        {pendingOrders.slice(0, 4).map((order, i) => {
          const isNew = newPendingOrders.some((o) => o.id === order.id);
          return (
            <TouchableOpacity
              key={order.id}
              style={[styles.mapPin, {
                backgroundColor: isNew ? "#EF4444" : colors.primary,
                top: 55 + (i % 2) * 60,
                left: 40 + i * 65,
              }]}
              onPress={() => handleOpenOrder(order)}
            >
              <Feather name="map-pin" size={14} color="#FFF" />
              <View style={[styles.pinBadge, { backgroundColor: isNew ? "#7F1D1D" : colors.dark }]}>
                <Text style={{ color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" }}>{i + 1}</Text>
              </View>
              {isNew && <View style={styles.pinPulse} />}
            </TouchableOpacity>
          );
        })}

        {/* My location dot */}
        <View style={[styles.myLocation, { borderColor: colors.primary, backgroundColor: "#FFF" }]}>
          <View style={[styles.myLocationInner, { backgroundColor: colors.primary }]} />
        </View>

        {/* Order count badge */}
        <View style={[styles.mapBadge, { backgroundColor: colors.primary }]}>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11 }}>
            {pendingOrders.length} {isRTL ? "طلبات" : "orders"}
          </Text>
        </View>
      </View>

      {/* Orders list */}
      <View style={[styles.ordersSection, { backgroundColor: colors.background }]}>
        <View style={[styles.listHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "الطلبات المتاحة" : "Available Orders"}
          </Text>
          <View style={[styles.countChip, { backgroundColor: colors.primary + "20" }]}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{pendingOrders.length}</Text>
          </View>
        </View>
        <FlatList
          data={pendingOrders}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ListEmptyComponent={
            <View style={styles.emptyHoriz}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 30 }]}>
                <Feather name="inbox" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                {t("common.noData")}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isNew = newPendingOrders.some((o) => o.id === item.id);
            return (
              <TouchableOpacity
                style={[
                  styles.pendingCard,
                  {
                    backgroundColor: colors.card,
                    borderRadius: colors.radius,
                    borderColor: isNew ? "#EF4444" : colors.border,
                    borderWidth: isNew ? 2 : 1.5,
                  },
                ]}
                onPress={() => handleOpenOrder(item)}
                activeOpacity={0.85}
              >
                <View style={[styles.cardAccent, { backgroundColor: isNew ? "#EF4444" : colors.primary }]} />
                <View style={styles.cardContent}>
                  {isNew && (
                    <View style={[styles.newBadge, { backgroundColor: "#EF4444" }]}>
                      <Text style={{ color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" }}>
                        {isRTL ? "جديد" : "NEW"}
                      </Text>
                    </View>
                  )}
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 2, textAlign: isRTL ? "right" : "left" }}>
                    {item.orderNumber}
                  </Text>
                  <View style={[styles.catChip, { backgroundColor: colors.accent, borderRadius: 8 }]}>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                      {t(`cat.${item.category}`)}
                    </Text>
                  </View>
                  <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Feather name="map-pin" size={11} color={colors.secondary} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 3, flex: 1 }} numberOfLines={1}>
                      {item.street}
                    </Text>
                  </View>
                  <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Feather name="calendar" size={11} color={colors.secondary} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 3 }}>
                      {item.visitDate}
                    </Text>
                  </View>
                  <View style={[styles.orderBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <TouchableOpacity
                      style={[styles.acceptBtn, { backgroundColor: colors.primary, borderRadius: 8, flex: 1 }]}
                      onPress={() => { setSelectedOrder(item); handleAccept(); }}
                    >
                      <Feather name="check" size={12} color="#FFF" />
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11, marginLeft: 4 }}>{t("tech.accept")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rejectBtn, { borderColor: colors.border, borderRadius: 8, flex: 1 }]}
                      onPress={() => {}}
                    >
                      <Feather name="x" size={12} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 4 }}>{t("tech.reject")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderRadius: 24 }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.modalTitle, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.modalIcon, { backgroundColor: "#FEE2E2", borderRadius: 12 }]}>
                <Feather name="bell" size={18} color="#EF4444" />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
                {t("tech.newOrder")}
              </Text>
              {selectedOrder && newPendingOrders.some((o) => o.id === selectedOrder.id) && (
                <View style={[styles.liveTag, { backgroundColor: "#EF4444" }]}>
                  <View style={styles.liveDot} />
                  <Text style={{ color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" }}>
                    {isRTL ? "مباشر" : "LIVE"}
                  </Text>
                </View>
              )}
            </View>
            {selectedOrder && (
              <>
                <View style={[styles.modalOrderNum, { backgroundColor: colors.muted, borderRadius: 10 }]}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{selectedOrder.orderNumber}</Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 2 }}>
                    {t(`cat.${selectedOrder.category}`)} — {selectedOrder.subCategory}
                  </Text>
                </View>
                {[
                  [t("order.problemDesc"),     selectedOrder.problemDescription],
                  [t("order.visitDate"),        `${selectedOrder.visitDate} ${selectedOrder.visitTime}`],
                  [isRTL ? "العنوان" : "Address", `${selectedOrder.street}, ${t("order.floor")} ${selectedOrder.floor}`],
                ].map(([label, value]) => (
                  <View key={label} style={[styles.modalRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>{label}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 2, textAlign: isRTL ? "left" : "right" }} numberOfLines={2}>{value}</Text>
                  </View>
                ))}
                <View style={[styles.modalBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <FanniButton title={t("tech.reject")} onPress={handleReject} variant="outline" style={{ flex: 1 }} />
                  <FanniButton title={t("tech.accept")} onPress={handleAccept} loading={loading} style={{ flex: 1 }} />
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
  onlineBadge: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFF" },
  mapPlaceholder: { height: 210, position: "relative", overflow: "hidden" },
  mapGrid: { ...StyleSheet.absoluteFillObject, flexDirection: "row", flexWrap: "wrap" },
  mapCell: { width: "20%", height: "25%", borderWidth: 0.5 },
  seaBand: { position: "absolute", top: 0, left: 0, right: 0, height: 38, alignItems: "center", justifyContent: "center" },
  cityLabel: { position: "absolute", top: 45, left: "38%", alignItems: "center" },
  cityDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 3 },
  districtTag: { position: "absolute", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  mapPin: { position: "absolute", width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  pinBadge: { position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  pinPulse: { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "#EF4444", opacity: 0.5 },
  myLocation: { position: "absolute", bottom: 20, right: 20, width: 18, height: 18, borderRadius: 9, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  myLocationInner: { width: 7, height: 7, borderRadius: 4 },
  mapBadge: { position: "absolute", bottom: 10, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ordersSection: { flex: 1 },
  listHeader: { paddingHorizontal: 16, paddingTop: 14, marginBottom: 10, alignItems: "center", gap: 8 },
  countChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12 },
  horizontalList: { paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 100 : 90, gap: 10 },
  pendingCard: { width: 210, flexDirection: "row", overflow: "hidden" },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: 12 },
  catChip: { alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 8, marginBottom: 8 },
  infoRow: { alignItems: "center", marginBottom: 5 },
  orderBtns: { gap: 6, marginTop: 8 },
  acceptBtn: { paddingVertical: 7, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  rejectBtn: { paddingVertical: 7, alignItems: "center", borderWidth: 1.5, backgroundColor: "transparent", flexDirection: "row", justifyContent: "center" },
  emptyHoriz: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingVertical: 20 },
  emptyIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  newBadge: { alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, marginBottom: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalContent: { padding: 24, margin: 12, marginBottom: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { alignItems: "center", marginBottom: 16, gap: 8 },
  modalIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  modalOrderNum: { padding: 14, marginBottom: 12 },
  modalRow: { paddingVertical: 10, borderBottomWidth: 1 },
  modalBtns: { marginTop: 20, gap: 10 },
  liveTag: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFF" },
});
