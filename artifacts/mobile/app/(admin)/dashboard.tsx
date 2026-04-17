import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";

export default function AdminDashboardScreen() {
  const colors = useColors();
  const { t, isRTL, setLanguage, language } = useApp();
  const { allOrders } = useOrders();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const completed = allOrders.filter((o) => o.status === "completed");
  const pending = allOrders.filter((o) => o.status === "pending");
  const active = allOrders.filter((o) => ["accepted", "inProgress"].includes(o.status));
  const totalRevenue = completed.reduce((sum, o) => sum + (o.invoice?.total ?? 0), 0);

  const stats = [
    { icon: "dollar-sign", label: t("admin.totalRevenue"), value: `${totalRevenue.toFixed(0)} ${t("common.egp")}`, color: "#38A169" },
    { icon: "activity", label: t("admin.activeOrders"), value: active.length.toString(), color: "#0077CC" },
    { icon: "tool", label: t("admin.registeredTechs"), value: "12", color: "#F5A623" },
    { icon: "users", label: t("admin.totalClients"), value: "48", color: "#6C5CE7" },
  ];

  const recentOrders = [...allOrders].reverse().slice(0, 5);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "لوحة المسئول" : "Admin Panel"}
          </Text>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, textAlign: isRTL ? "right" : "left" }}>
            {t("admin.dashboard")}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.langBtn, { borderColor: "rgba(255,255,255,0.3)" }]}
          onPress={() => setLanguage(language === "ar" ? "en" : "ar")}
        >
          <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
            {language === "ar" ? "EN" : "عر"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
      >
        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border },
              ]}
            >
              <View style={[styles.statIcon, { backgroundColor: stat.color + "22", borderRadius: 10 }]}>
                <Feather name={stat.icon as any} size={22} color={stat.color} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 10 }}>
                {stat.value}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", marginTop: 4 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Recent orders */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "آخر الطلبات" : "Recent Orders"}
        </Text>

        {recentOrders.map((order) => (
          <View
            key={order.id}
            style={[
              styles.orderRow,
              { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <View
              style={[
                styles.orderDot,
                {
                  backgroundColor:
                    order.status === "completed" ? colors.success :
                    order.status === "pending" ? colors.primary :
                    "#0077CC",
                },
              ]}
            />
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {order.orderNumber}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                {order.clientName} — {t(`cat.${order.category}`)}
              </Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: order.status === "completed" ? "#E6F9F0" : order.status === "pending" ? "#FFF3DC" : "#E6F4FF", borderRadius: 8 }]}>
              <Text style={{ color: order.status === "completed" ? colors.success : order.status === "pending" ? colors.primary : "#0077CC", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                {t(`order.status.${order.status}`)}
              </Text>
            </View>
          </View>
        ))}

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "إجراءات سريعة" : "Quick Actions"}
        </Text>
        <View style={[styles.actionsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            { icon: "users", label: t("admin.users") },
            { icon: "list", label: t("admin.orders") },
            { icon: "bar-chart-2", label: t("admin.stats") },
            { icon: "shield", label: t("admin.permissions") },
          ].map((item) => (
            <View
              key={item.label}
              style={[
                styles.actionCard,
                { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border },
              ]}
            >
              <Feather name={item.icon as any} size={24} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 8, textAlign: "center" }} numberOfLines={2}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  langBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  statCard: { width: "47%", padding: 16, borderWidth: 1.5, alignItems: "center" },
  statIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18, marginBottom: 14 },
  orderRow: { padding: 14, marginBottom: 10, borderWidth: 1.5, alignItems: "center" },
  orderDot: { width: 10, height: 10, borderRadius: 5 },
  statusDot: { paddingVertical: 4, paddingHorizontal: 10 },
  actionsRow: { gap: 12 },
  actionCard: { flex: 1, paddingVertical: 16, alignItems: "center", borderWidth: 1.5 },
});
