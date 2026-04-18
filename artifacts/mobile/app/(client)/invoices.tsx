import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import AppHeader from "@/components/AppHeader";

export default function ClientInvoicesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { getOrdersByClient } = useOrders();
  const orders = getOrdersByClient(user?.id ?? "client1").filter((o) => o.invoice);

  const totalPaid = orders.reduce((sum, o) => sum + (o.invoice?.total ?? 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("nav.invoices")} />

      {/* Summary banner */}
      <View style={[styles.summaryBanner, { backgroundColor: colors.darkMid }]}>
        <View style={[styles.summaryInner, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "إجمالي المدفوع" : "Total Paid"}
            </Text>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 26, textAlign: isRTL ? "right" : "left" }}>
              {totalPaid.toFixed(0)} <Text style={{ fontSize: 14 }}>{t("common.egp")}</Text>
            </Text>
          </View>
          <View style={[styles.summaryIcon, { backgroundColor: "rgba(245,166,35,0.15)" }]}>
            <Feather name="file-text" size={28} color={colors.primary} />
          </View>
        </View>
        <View style={[styles.summaryFooter, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.statChip, { backgroundColor: "rgba(77,173,217,0.15)" }]}>
            <Feather name="check-circle" size={13} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
              {orders.length} {isRTL ? "فاتورة" : "invoices"}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 40 }]}>
              <Feather name="file-text" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 14, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              {t("common.noData")}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          item.invoice ? (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/order-details", params: { orderId: item.id } })}
              activeOpacity={0.85}
            >
              <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
              <View style={styles.cardBody}>
                <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.accent, borderRadius: 12 }]}>
                    <Feather name="file-text" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                      {t("invoice.number")} {item.invoice.invoiceNumber}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                      {item.invoice.date} · {t(`cat.${item.category}`)}
                    </Text>
                  </View>
                  <View style={[styles.totalChip, { backgroundColor: colors.accent, borderRadius: 10 }]}>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{item.invoice.total.toFixed(0)}</Text>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 }}>{t("common.egp")}</Text>
                  </View>
                </View>
                {item.technicianName && (
                  <View style={[styles.techRow, { borderTopColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Feather name="user" size={13} color={colors.secondary} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: isRTL ? 0 : 5, marginRight: isRTL ? 5 : 0 }}>
                      {item.technicianName}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryBanner: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 16, padding: 18 },
  summaryInner: { alignItems: "center", marginBottom: 12 },
  summaryIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  summaryFooter: { gap: 8 },
  statChip: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  card: { marginBottom: 12, borderWidth: 1.5, flexDirection: "row", overflow: "hidden", shadowColor: "#0D1B2A", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { alignItems: "center", gap: 0 },
  iconWrap: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  totalChip: { paddingVertical: 8, paddingHorizontal: 12, alignItems: "center" },
  techRow: { marginTop: 10, borderTopWidth: 1, paddingTop: 10, alignItems: "center", gap: 0 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
});
