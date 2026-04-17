import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders, Order, MaterialItem } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";

export default function TechOrdersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { getOrdersByTech, updateOrder } = useOrders();
  const insets = useSafeAreaInsets();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [solutionDesc, setSolutionDesc] = useState("");
  const [satisfaction, setSatisfaction] = useState<"satisfied" | "neutral" | "unsatisfied" | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [matDesc, setMatDesc] = useState("");
  const [matAmount, setMatAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const orders = getOrdersByTech(user?.id ?? "tech1");
  const activeOrders = orders.filter((o) => ["accepted", "inProgress"].includes(o.status));
  const historyOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));

  const addMaterial = () => {
    if (!matDesc || !matAmount) return;
    const id = Date.now().toString();
    setMaterials([...materials, { id, description: matDesc, amount: parseFloat(matAmount) }]);
    setMatDesc("");
    setMatAmount("");
  };

  const handleComplete = async (orderId: string) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    const matTotal = materials.reduce((sum, m) => sum + m.amount, 0);
    const markup = matTotal * 0.1;
    const labor = 200;
    const tools = 50;
    const tax = (matTotal + markup + labor + tools) * 0.14;
    const vat = (matTotal + markup + labor + tools) * 0.15;
    const total = matTotal + markup + labor + tools + tax + vat;
    const invNum = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    await updateOrder(orderId, {
      status: "completed",
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
    });
    setLoading(false);
    setShowComplete(false);
    setSelectedOrderId(null);
    setSolutionDesc("");
    setMaterials([]);
    setSatisfaction(null);
  };

  const renderOrderCard = ({ item }: { item: Order }) => (
    <View
      style={[
        styles.orderCard,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
            {item.orderNumber}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
            {t(`cat.${item.category}`)} — {item.subCategory}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Feather name="user" size={13} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: 6 }}>{item.clientName}</Text>
        <Feather name="phone" size={13} color={colors.mutedForeground} style={{ marginLeft: 12 }} />
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", marginLeft: 4 }}>{item.clientMobile}</Text>
      </View>
      <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Feather name="map-pin" size={13} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 6 }} numberOfLines={1}>
          {item.street}, {t("order.floor")} {item.floor}
        </Text>
      </View>
      <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Feather name="calendar" size={13} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 6 }}>
          {item.visitDate} {item.visitTime}
        </Text>
      </View>

      {(item.status === "accepted" || item.status === "inProgress") && (
        <FanniButton
          title={t("tech.complete")}
          onPress={() => { setSelectedOrderId(item.id); setShowComplete(true); }}
          variant="outline"
          style={{ marginTop: 12 }}
          fullWidth
        />
      )}

      {item.status === "completed" && item.invoice && (
        <View style={[styles.invoiceSummary, { backgroundColor: colors.accent, borderRadius: colors.radius }]}>
          <Feather name="file-text" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
            {t("invoice.total")}: {item.invoice.total.toFixed(0)} {t("common.egp")}
          </Text>
        </View>
      )}
    </View>
  );

  if (showComplete && selectedOrderId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 12 }]}>
          <TouchableOpacity style={[styles.backBtn, { [isRTL ? "right" : "left"]: 16 }]} onPress={() => setShowComplete(false)}>
            <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
            {t("tech.complete")}
          </Text>
        </View>
        <ScrollView contentContainerStyle={[styles.completeContent, { paddingBottom: botPad + 24 }]} keyboardShouldPersistTaps="handled">
          {/* Materials */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("tech.materials")}
            </Text>
            {materials.map((m) => (
              <View key={m.id} style={[styles.matItem, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 }}>{m.description}</Text>
                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{m.amount} {t("common.egp")}</Text>
              </View>
            ))}
            <View style={[styles.matForm, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <FanniInput
                placeholder={isRTL ? "الوصف" : "Description"}
                value={matDesc}
                onChangeText={setMatDesc}
                style={{ flex: 2, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0, marginBottom: 0 }}
              />
              <FanniInput
                placeholder={isRTL ? "المبلغ" : "Amount"}
                value={matAmount}
                onChangeText={setMatAmount}
                keyboardType="numeric"
                style={{ flex: 1, marginBottom: 0 }}
              />
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                onPress={addMaterial}
              >
                <Feather name="plus" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Solution */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("tech.solutionDesc")}
            </Text>
            <FanniInput
              value={solutionDesc}
              onChangeText={setSolutionDesc}
              multiline
              numberOfLines={4}
              placeholder={isRTL ? "اشرح الحل الذي تم..." : "Describe the solution applied..."}
            />
          </View>

          {/* Satisfaction */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("tech.clientSatisfied")}
            </Text>
            {(["satisfied", "neutral", "unsatisfied"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.satisfactionOption,
                  {
                    borderColor: satisfaction === s ? colors.primary : colors.border,
                    backgroundColor: satisfaction === s ? colors.accent : colors.background,
                    borderRadius: colors.radius,
                    flexDirection: isRTL ? "row-reverse" : "row",
                  },
                ]}
                onPress={() => setSatisfaction(s)}
              >
                <Feather
                  name={s === "satisfied" ? "smile" : s === "neutral" ? "meh" : "frown"}
                  size={20}
                  color={satisfaction === s ? colors.primary : colors.mutedForeground}
                />
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
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("nav.orders")}
        </Text>
      </View>

      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, paddingHorizontal: 16, paddingTop: 16, marginBottom: 8, textAlign: isRTL ? "right" : "left" }}>
        {isRTL ? "الطلبات الحالية" : "Active Orders"} ({activeOrders.length})
      </Text>

      <FlatList
        data={[...activeOrders, ...historyOrders]}
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
        renderItem={renderOrderCard}
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
  backBtn: { position: "absolute", bottom: 20, padding: 4 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  orderCard: {
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { alignItems: "flex-start", marginBottom: 10, gap: 8 },
  infoRow: { alignItems: "center", marginBottom: 6, gap: 0 },
  invoiceSummary: { flexDirection: "row", alignItems: "center", padding: 10, marginTop: 8 },
  empty: { alignItems: "center", paddingTop: 80 },
  completeContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  section: {
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, marginBottom: 14 },
  matItem: { paddingVertical: 8, borderBottomWidth: 1, alignItems: "center", marginBottom: 4 },
  matForm: { marginTop: 12, alignItems: "center", gap: 8 },
  addBtn: { padding: 12 },
  satisfactionOption: { padding: 14, marginBottom: 10, borderWidth: 1.5, alignItems: "center", gap: 10 },
});
