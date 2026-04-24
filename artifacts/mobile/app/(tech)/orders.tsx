import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Platform, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders, Order, MaterialItem } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getApiBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

export default function TechOrdersScreen() {
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { sessionToken } = useAuth();
  const { getOrdersByTech, updateOrder } = useOrders();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [solutionDesc, setSolutionDesc] = useState("");
  const [satisfaction, setSatisfaction] = useState<"satisfied" | "neutral" | "unsatisfied" | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [matDesc, setMatDesc] = useState("");
  const [matAmount, setMatAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const orders = getOrdersByTech(user?.id ?? "tech1");
  const activeOrders = orders.filter((o) => ["accepted", "inProgress"].includes(o.status));
  const historyOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));

  const addMaterial = () => {
    if (!matDesc || !matAmount) return;
    setMaterials([...materials, { id: Date.now().toString(), description: matDesc, amount: parseFloat(matAmount) }]);
    setMatDesc("");
    setMatAmount("");
  };

  const handleComplete = async (orderId: string) => {
    setLoading(true);
    const matTotal = materials.reduce((sum, m) => sum + m.amount, 0);
    const markup = matTotal * 0.1;
    const labor = 200;
    const tools = 50;
    const tax = (matTotal + markup + labor + tools) * 0.14;
    const vat = (matTotal + markup + labor + tools) * 0.15;
    const total = matTotal + markup + labor + tools + tax + vat;
    const invNum = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const completionPayload = {
      status: "completed" as const,
      solutionDescription: solutionDesc,
      clientSatisfaction: satisfaction ?? "satisfied",
      materials,
      invoice: {
        invoiceNumber: invNum,
        date: new Date().toISOString().split("T")[0],
        materialsTotal: matTotal,
        materialsMark: markup,
        laborFee: labor,
        toolRental: tools,
        tax,
        vat,
        total,
        companyName: "فني للصيانة المنزلية",
        companyPhone: "01000000000",
        orderId,
        clientName: orders.find((o) => o.id === orderId)?.clientName ?? "",
        technicianName: user?.name ?? "",
      },
    };
    let serverSynced = false;
    try {
      const apiBase = getApiBaseUrl();
      if (apiBase && sessionToken) {
        const res = await fetch(`${apiBase}/api/orders/${orderId}/complete`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            solutionDescription: completionPayload.solutionDescription,
            clientSatisfaction: completionPayload.clientSatisfaction,
            materials: completionPayload.materials,
            invoice: completionPayload.invoice,
          }),
        });
        if (res.ok) {
          serverSynced = true;
        } else {
          console.warn(`[Fanni] Failed to complete order on server: ${res.status}`);
        }
      }
    } catch (err) {
      console.warn("[Fanni] Network error completing order:", err);
    }
    if (serverSynced || !sessionToken) {
      await updateOrder(orderId, completionPayload);
    }
    setLoading(false);
    setShowComplete(false);
    setSelectedOrderId(null);
    setSolutionDesc("");
    setMaterials([]);
    setSatisfaction(null);
  };

  const renderCard = ({ item }: { item: Order }) => {
    const isActive = ["accepted", "inProgress"].includes(item.status);
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        <View style={[styles.accentBar, { backgroundColor: isActive ? colors.primary : colors.success }]} />
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
          <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Feather name="user" size={12} color={colors.secondary} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, marginLeft: 5, flex: 1 }}>{item.clientName}</Text>
            <Feather name="phone" size={12} color={colors.secondary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4 }}>{item.clientMobile}</Text>
          </View>
          <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Feather name="map-pin" size={12} color={colors.secondary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 5, flex: 1 }} numberOfLines={1}>
              {item.street}, {t("order.floor")} {item.floor}
            </Text>
            <Feather name="calendar" size={12} color={colors.secondary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4 }}>
              {item.visitDate}
            </Text>
          </View>
          {isActive && (
            <View style={[styles.actionRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <TouchableOpacity
                style={[styles.messageBtn, { backgroundColor: colors.darkMid, borderRadius: colors.radius - 4 }]}
                onPress={() => Linking.openURL(`sms:${item.clientMobile}`)}
              >
                <Feather name="message-circle" size={14} color={colors.secondary} />
                <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>{t("order.messageClient")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.messageBtn, { backgroundColor: colors.darkMid, borderRadius: colors.radius - 4 }]}
                onPress={() => Linking.openURL(`tel:${item.clientMobile}`)}
              >
                <Feather name="phone" size={14} color={colors.secondary} />
                <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>{t("order.callClient")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.completeBtn, { backgroundColor: colors.darkMid, borderRadius: colors.radius - 4, flex: 1 }]}
                onPress={() => { setSelectedOrderId(item.id); setShowComplete(true); }}
              >
                <Feather name="check-circle" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13, marginLeft: 6 }}>{t("tech.complete")}</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.status === "completed" && item.invoice && (
            <View style={[styles.invoiceSummary, { backgroundColor: colors.accent, borderRadius: colors.radius - 4 }]}>
              <Feather name="file-text" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 6 }}>
                {t("invoice.total")}: {item.invoice.total.toFixed(0)} {t("common.egp")}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (showComplete && selectedOrderId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("tech.complete")} showBack onBack={() => setShowComplete(false)} />
        <ScrollView contentContainerStyle={[styles.completeContent, { paddingBottom: botPad + 24 }]} keyboardShouldPersistTaps="handled">
          {/* Materials */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>{t("tech.materials")}</Text>
            {materials.map((m) => (
              <View key={m.id} style={[styles.matItem, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 }}>{m.description}</Text>
                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{m.amount} {t("common.egp")}</Text>
                <TouchableOpacity onPress={() => setMaterials(materials.filter((x) => x.id !== m.id))} style={{ marginLeft: 10 }}>
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={[styles.matForm, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <FanniInput placeholder={isRTL ? "الوصف" : "Description"} value={matDesc} onChangeText={setMatDesc} style={{ flex: 2, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0, marginBottom: 0 }} />
              <FanniInput placeholder={isRTL ? "المبلغ" : "Amount"} value={matAmount} onChangeText={setMatAmount} keyboardType="numeric" style={{ flex: 1, marginBottom: 0 }} />
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: 10 }]} onPress={addMaterial}>
                <Feather name="plus" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Solution */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>{t("tech.solutionDesc")}</Text>
            <FanniInput value={solutionDesc} onChangeText={setSolutionDesc} multiline numberOfLines={4} placeholder={isRTL ? "اشرح الحل الذي تم..." : "Describe the solution applied..."} />
          </View>

          {/* Satisfaction */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>{t("tech.clientSatisfied")}</Text>
            {(["satisfied", "neutral", "unsatisfied"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.satisfactionOption, { borderColor: satisfaction === s ? colors.primary : colors.border, backgroundColor: satisfaction === s ? colors.accent : colors.background, borderRadius: colors.radius - 4, flexDirection: isRTL ? "row-reverse" : "row" }]}
                onPress={() => setSatisfaction(s)}
              >
                <Feather name={s === "satisfied" ? "smile" : s === "neutral" ? "meh" : "frown"} size={20} color={satisfaction === s ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: satisfaction === s ? colors.primary : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14, marginLeft: 10 }}>
                  {t(`tech.${s}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FanniButton
            title={isRTL ? "إنهاء وإصدار الفاتورة" : "Complete & Generate Invoice"}
            onPress={() => handleComplete(selectedOrderId)}
            loading={loading}
            fullWidth
            style={{ marginHorizontal: 16 }}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("nav.orders")}
        subtitle={`${activeOrders.length} ${isRTL ? "طلبات نشطة" : "active"}`}
      />
      <FlatList
        data={[...activeOrders, ...historyOrders]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        ListHeaderComponent={
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, paddingBottom: 8, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "الطلبات الحالية والسابقة" : "Current & Past Orders"}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 36 }]}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>{t("common.noData")}</Text>
          </View>
        }
        renderItem={renderCard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  card: { marginBottom: 12, borderWidth: 1.5, flexDirection: "row", overflow: "hidden" },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { alignItems: "flex-start", marginBottom: 8, gap: 8 },
  infoRow: { alignItems: "center", marginBottom: 6, gap: 0 },
  actionRow: { marginTop: 8, gap: 8 },
  messageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10 },
  completeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10 },
  invoiceSummary: { flexDirection: "row", alignItems: "center", padding: 10, marginTop: 8 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  completeContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  section: { padding: 16, borderWidth: 1.5 },
  sectionTitle: { fontSize: 16, marginBottom: 14 },
  matItem: { paddingVertical: 8, borderBottomWidth: 1, alignItems: "center", marginBottom: 4 },
  matForm: { marginTop: 12, alignItems: "center", gap: 8 },
  addBtn: { padding: 12 },
  satisfactionOption: { padding: 14, marginBottom: 10, borderWidth: 1.5, alignItems: "center" },
});
