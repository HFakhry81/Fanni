import React from "react";
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

export default function ClientInvoicesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { getOrdersByClient } = useOrders();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const orders = getOrdersByClient(user?.id ?? "client1").filter((o) => o.invoice);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("nav.invoices")}
        </Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 100 : 90 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="file-text" size={48} color={colors.border} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              {t("common.noData")}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          item.invoice ? (
            <TouchableOpacity
              style={[
                styles.card,
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
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: colors.accent, borderRadius: colors.radius },
                  ]}
                >
                  <Feather name="file-text" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: "Inter_700Bold",
                      fontSize: 15,
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    {t("invoice.number")} {item.invoice.invoiceNumber}
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    {item.invoice.date}
                  </Text>
                </View>
                <View
                  style={[
                    styles.totalBadge,
                    { backgroundColor: colors.accent, borderRadius: colors.radius },
                  ]}
                >
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {item.invoice.total}
                  </Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                    {t("common.egp")}
                  </Text>
                </View>
              </View>
              <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Feather name="user" size={13} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4 }}>
                  {item.technicianName}
                </Text>
                <View style={[styles.dot, { backgroundColor: colors.border }]} />
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                  {t(`cat.${item.category}`)}
                </Text>
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
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 22 },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  card: {
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { alignItems: "center", marginBottom: 12, gap: 0 },
  iconWrap: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  totalBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  infoRow: { alignItems: "center", gap: 6 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  empty: { alignItems: "center", paddingTop: 80 },
});
