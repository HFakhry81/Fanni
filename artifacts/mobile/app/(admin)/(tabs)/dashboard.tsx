import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { allOrders } = useOrders();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const completed = allOrders.filter((o) => o.status === "completed");
  const pending = allOrders.filter((o) => o.status === "pending");
  const active = allOrders.filter((o) => ["accepted", "inProgress"].includes(o.status));
  const totalRevenue = completed.reduce((sum, o) => sum + (o.invoice?.total ?? 0), 0);

  const kpis = [
    { icon: "dollar-sign", label: t("admin.totalRevenue"), value: `${totalRevenue.toFixed(0)}`, unit: t("common.egp"), color: colors.primary,   bg: colors.accent },
    { icon: "activity",    label: t("admin.activeOrders"), value: active.length.toString(),     unit: "",                color: colors.secondary, bg: colors.accentBlue },
    { icon: "tool",        label: t("admin.registeredTechs"), value: "12",                      unit: "",                color: "#7C5CBF",        bg: "#EDE9FE" },
    { icon: "users",       label: t("admin.totalClients"),    value: "48",                      unit: "",                color: "#22A36B",        bg: "#D4EDDA" },
  ];

  const recentOrders = [...allOrders].reverse().slice(0, 5);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.dashboard")}
        subtitle={isRTL ? "لوحة تحكم المسئول" : "Admin Control Panel"}
        showHome
        showLogout
        showLangToggle
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          {kpis.map((kpi) => (
            <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: kpi.bg, borderRadius: 12 }]}>
                <VectorIcon name={kpi.icon as any} size={22} color={kpi.color} />
              </View>
              <Text style={{ color: kpi.color, fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 10 }}>
                {kpi.value}<Text style={{ fontSize: 13, fontFamily: "Inter_500Medium" }}> {kpi.unit}</Text>
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", marginTop: 4 }}>
                {kpi.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Status summary strip */}
        <View style={[styles.statusStrip, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            { label: isRTL ? "في الانتظار" : "Pending",   count: pending.length,   color: colors.primary },
            { label: isRTL ? "نشطة" : "Active",            count: active.length,    color: colors.secondary },
            { label: isRTL ? "مكتملة" : "Completed",       count: completed.length, color: colors.success },
          ].map((s, i) => (
            <View key={s.label} style={[styles.stripItem, { borderRightWidth: i < 2 ? 1 : 0, borderRightColor: colors.border }]}>
              <Text style={{ color: s.color, fontFamily: "Inter_700Bold", fontSize: 22 }}>{s.count}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Recent orders */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "آخر الطلبات" : "Recent Orders"}
        </Text>
        {recentOrders.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={[styles.orderRow, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={() => router.push({ pathname: "/order-details", params: { orderId: order.id } })}
            activeOpacity={0.85}
          >
            <View style={[styles.orderDot, { backgroundColor: order.status === "completed" ? colors.success : order.status === "pending" ? colors.primary : colors.secondary }]} />
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{order.orderNumber}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                {order.clientName} · {t(`cat.${order.category}`)}
              </Text>
            </View>
            <StatusBadge status={order.status} />
          </TouchableOpacity>
        ))}

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "إجراءات سريعة" : "Quick Actions"}
        </Text>
        <View style={[styles.actionsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            { icon: "users",      label: t("admin.users"),       color: colors.secondary, route: "/(admin)/users" },
            { icon: "list",       label: t("admin.orders"),      color: colors.primary,   route: "/(admin)/orders" },
            { icon: "bar-chart-2",label: t("admin.stats"),       color: "#7C5CBF",        route: "/(admin)/stats" },
            { icon: "shield",     label: t("admin.permissions"), color: "#22A36B",        route: "/(admin)/permissions" },
            { icon: "user-plus",  label: isRTL ? "إضافة مسئول" : "Add Admin", color: colors.primary, route: "/(admin)/add-admin" },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.actionCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIcon, { backgroundColor: item.color + "18", borderRadius: 12 }]}>
                <VectorIcon name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 8, textAlign: "center" }} numberOfLines={2}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  kpiCard: { width: "47%", padding: 16, borderWidth: 1.5, alignItems: "center" },
  kpiIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  statusStrip: { padding: 16, borderWidth: 1.5, marginBottom: 24 },
  stripItem: { flex: 1, alignItems: "center", paddingVertical: 4 },
  sectionTitle: { fontSize: 17, marginBottom: 12 },
  orderRow: { padding: 14, marginBottom: 10, borderWidth: 1.5, alignItems: "center" },
  orderDot: { width: 10, height: 10, borderRadius: 5 },
  actionsRow: { gap: 10, marginBottom: 8 },
  actionCard: { flex: 1, paddingVertical: 16, alignItems: "center", borderWidth: 1.5 },
  actionIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
});
