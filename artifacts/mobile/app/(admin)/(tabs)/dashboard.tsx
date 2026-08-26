import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import VectorIcon, { type IconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import { getApiBase } from "@/utils/api";

const ADMIN_HOME = "/(admin)/(tabs)/dashboard";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { allOrders } = useOrders();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [isRegeocoding, setIsRegeocoding] = useState(false);

  const completed = allOrders.filter((o) => o.status === "completed");
  const pending = allOrders.filter((o) => o.status === "pending");
  const active = allOrders.filter((o) => ["accepted", "inProgress"].includes(o.status));
  const totalRevenue = completed.reduce((sum, o) => sum + (o.invoice?.total ?? 0), 0);

  const kpis: { icon: IconName; label: string; value: string; unit: string; color: string; bg: string }[] = [
    { icon: "dollar-sign", label: t("admin.totalRevenue"), value: `${totalRevenue.toFixed(0)}`, unit: t("common.egp"), color: colors.primary,   bg: colors.accent },
    { icon: "activity",    label: t("admin.activeOrders"), value: active.length.toString(),     unit: "",                color: colors.secondary, bg: colors.accentBlue },
    { icon: "tool",        label: t("admin.registeredTechs"), value: "12",                      unit: "",                color: "#7C5CBF",        bg: "#EDE9FE" },
    { icon: "users",       label: t("admin.totalClients"),    value: "48",                      unit: "",                color: "#22A36B",        bg: "#D4EDDA" },
  ];

  const recentOrders = [...allOrders].reverse().slice(0, 5);

  async function handleRegeocodeLocations() {
    Alert.alert(
      isRTL ? "إعادة تحديد المواقع" : "Re-Geocode Locations",
      isRTL
        ? "سيحاول النظام تحديد إحداثيات الفنيين الذين لا تزال مواقعهم غير محددة. هل تريد المتابعة؟"
        : "This will attempt to geocode all technicians that still have no map location. Continue?",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "تأكيد" : "Confirm",
          onPress: async () => {
            setIsRegeocoding(true);
            try {
              const base = getApiBase();
              if (!base) {
                Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "عنوان الخادم غير مضبوط" : "API base URL is not configured");
                return;
              }
              const resp = await fetch(`${base}/api/admin/technicians/backfill-locations`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
                },
                credentials: "include",
              });
              let data: { success?: boolean; total?: number; updated?: number; skipped?: number; errors?: number; error?: string } = {};
              try {
                data = await resp.json() as typeof data;
              } catch {
                // non-JSON body
              }
              if (!resp.ok || !data.success) {
                const detail = data.error
                  ?? (resp.status === 401 || resp.status === 403
                    ? (isRTL ? "غير مصرح — سجّل الدخول مجدداً" : "Unauthorized — sign in again")
                    : (isRTL ? `فشل الطلب (${resp.status})` : `Request failed (${resp.status})`));
                Alert.alert(isRTL ? "خطأ" : "Error", detail);
                return;
              }
              const msg = isRTL
                ? `الإجمالي: ${data.total}\nتم التحديث: ${data.updated}\nتم التخطي: ${data.skipped}\nأخطاء: ${data.errors}`
                : `Total: ${data.total}\nUpdated: ${data.updated}\nSkipped: ${data.skipped}\nErrors: ${data.errors}`;
              Alert.alert(isRTL ? "اكتمل" : "Done", msg);
            } catch {
              Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "تعذر الاتصال بالخادم" : "Could not reach the server");
            } finally {
              setIsRegeocoding(false);
            }
          },
        },
      ],
    );
  }

  const quickActions: { icon: IconName; label: string; color: string; route: string }[] = [
    { icon: "users", label: t("admin.users"), color: colors.secondary, route: "/(admin)/(tabs)/users" },
    { icon: "list", label: t("admin.orders"), color: colors.primary, route: "/(admin)/(tabs)/orders" },
    { icon: "credit-card", label: isRTL ? "المدفوعات" : "Payments", color: "#22A36B", route: "/(admin)/(tabs)/payments" },
    { icon: "alert-circle", label: isRTL ? "النزاعات" : "Disputes", color: "#C8880A", route: "/(admin)/(tabs)/disputes" },
    { icon: "book-open", label: isRTL ? "الأستاذ" : "Ledger", color: "#7C5CBF", route: "/(admin)/(tabs)/ledger" },
    { icon: "dollar-sign", label: isRTL ? "تسعير Lead" : "Lead Pricing", color: "#C8880A", route: "/(admin)/(tabs)/lead-pricing" },
    { icon: "shield", label: isRTL ? "التدقيق" : "Audit", color: "#22A36B", route: "/(admin)/(tabs)/audit-logs" },
    { icon: "user", label: isRTL ? "ملفي" : "My Profile", color: "#4DADD9", route: "/(admin)/(tabs)/profile" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.dashboard")}
        subtitle={isRTL ? "لوحة تحكم المسئول" : "Admin Control Panel"}
        showHome
        showLogout
        showLangToggle
        showProfile
        homeHref={ADMIN_HOME}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        <View style={styles.kpiGrid}>
          {kpis.map((kpi) => (
            <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <View style={[styles.kpiIcon, { backgroundColor: kpi.bg, borderRadius: 12 }]}>
                <VectorIcon name={kpi.icon} size={22} color={kpi.color} />
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

        <View style={[styles.statusStrip, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            { label: isRTL ? "في الانتظار" : "Pending", count: pending.length, color: colors.primary },
            { label: isRTL ? "نشطة" : "Active", count: active.length, color: colors.secondary },
            { label: isRTL ? "مكتملة" : "Completed", count: completed.length, color: colors.success },
          ].map((s, i) => (
            <View key={s.label} style={[styles.stripItem, { borderRightWidth: i < 2 ? 1 : 0, borderRightColor: colors.border }]}>
              <Text style={{ color: s.color, fontFamily: "Inter_700Bold", fontSize: 22 }}>{s.count}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

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

        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "إجراءات سريعة" : "Quick Actions"}
        </Text>
        <View style={[styles.actionsRow, { flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap" }]}>
          {quickActions.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.actionCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, width: "23%" }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIcon, { backgroundColor: item.color + "18", borderRadius: 12 }]}>
                <VectorIcon name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 8, textAlign: "center" }} numberOfLines={2}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left", marginTop: 8 }]}>
          {isRTL ? "أدوات الموقع" : "Location Tools"}
        </Text>
        <TouchableOpacity
          style={[styles.toolRow, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={handleRegeocodeLocations}
          disabled={isRegeocoding}
          activeOpacity={0.85}
        >
          <View style={[styles.toolIcon, { backgroundColor: "#0EA5E918", borderRadius: 12 }]}>
            {isRegeocoding
              ? <ActivityIndicator size="small" color="#0EA5E9" />
              : <VectorIcon name="map-pin" size={22} color="#0EA5E9" />
            }
          </View>
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {isRTL ? "إعادة تحديد مواقع الفنيين" : "Re-Geocode Technician Locations"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
              {isRTL ? "تحديث إحداثيات الفنيين الذين لا تزال مواقعهم غير محددة" : "Fix map coordinates for technicians with no location set"}
            </Text>
          </View>
          <VectorIcon name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolRow, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={() => router.push("/(admin)/(tabs)/map-dashboard")}
          activeOpacity={0.85}
        >
          <View style={[styles.toolIcon, { backgroundColor: "#4DADD918", borderRadius: 12 }]}>
            <VectorIcon name="map" size={22} color="#4DADD9" />
          </View>
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {isRTL ? "خريطة الفنيين الحية" : "Live Technician Map"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
              {isRTL ? "عرض مواقع الفنيين والطلبات النشطة" : "View technician and active order locations"}
            </Text>
          </View>
          <VectorIcon name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolRow, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={() => router.push("/(admin)/(tabs)/missed-locations")}
          activeOpacity={0.85}
        >
          <View style={[styles.toolIcon, { backgroundColor: "#E67E2218", borderRadius: 12 }]}>
            <VectorIcon name="alert-triangle" size={22} color="#E67E22" />
          </View>
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {isRTL ? "عناوين غير مطابقة" : "Missed Locations"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
              {isRTL ? "ربط الأسماء العامية بالمناطق الرسمية" : "Map informal place names to official areas"}
            </Text>
          </View>
          <VectorIcon name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
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
  actionCard: { paddingVertical: 16, alignItems: "center", borderWidth: 1.5, minWidth: "22%" },
  actionIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  toolRow: { padding: 14, borderWidth: 1.5, alignItems: "center", marginBottom: 10 },
  toolIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
});
