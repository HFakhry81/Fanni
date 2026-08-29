import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import VectorIcon, { type IconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import AdminLiveMapPreview from "@/components/AdminLiveMapPreview";
import { getApiBase } from "@/utils/api";

const ADMIN_HOME = "/(admin)/(tabs)/dashboard";

interface DashboardStats {
  totalClients: number;
  registeredTechs: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalRevenue: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  category: string;
  clientName: string;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { sessionToken, user: authUser } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [isRegeocoding, setIsRegeocoding] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  const loadDashboard = useCallback(async () => {
    if (!sessionToken) return;
    const base = getApiBase();
    if (!base) return;
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      const [statsRes, ordersRes] = await Promise.all([
        fetch(`${base}/api/admin/dashboard/stats`, { headers }),
        fetch(`${base}/api/admin/orders?limit=5`, { headers }),
      ]);
      if (statsRes.ok) {
        setStats(await statsRes.json() as DashboardStats);
      }
      if (ordersRes.ok) {
        const data = await ordersRes.json() as { orders?: RecentOrder[] };
        setRecentOrders(data.orders ?? []);
      }
    } catch {
      // keep last values
    }
  }, [sessionToken]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const authDisplayName = [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ").trim();
  const adminName = user?.name?.trim() || authDisplayName || (isRTL ? "المسئول" : "Admin");

  const kpis: { icon: IconName; label: string; value: string; unit: string; color: string; bg: string }[] = [
    { icon: "dollar-sign", label: t("admin.totalRevenue"), value: `${(stats?.totalRevenue ?? 0).toFixed(0)}`, unit: t("common.egp"), color: colors.primary, bg: colors.accent },
    { icon: "activity", label: t("admin.activeOrders"), value: String(stats?.activeOrders ?? 0), unit: "", color: colors.secondary, bg: colors.accentBlue },
    { icon: "tool", label: t("admin.registeredTechs"), value: String(stats?.registeredTechs ?? 0), unit: "", color: "#7C5CBF", bg: "#EDE9FE" },
    { icon: "users", label: t("admin.totalClients"), value: String(stats?.totalClients ?? 0), unit: "", color: "#22A36B", bg: "#D4EDDA" },
  ];

  async function handleRegeocodeLocations() {
    Alert.alert(
      isRTL ? "إعادة تحديد المواقع" : "Re-Geocode Locations",
      isRTL
        ? "سيُعالَج حتى 20 فنيًا في كل مرة (قد يستغرق أقل من دقيقة). يمكنك التكرار إن بقي المزيد."
        : "Up to 20 technicians are processed per run (usually under a minute). Run again if more remain.",
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
                body: JSON.stringify({ limit: 20 }),
                credentials: "include",
              });
              const raw = await resp.text();
              let data: {
                success?: boolean;
                total?: number;
                updated?: number;
                skipped?: number;
                errors?: number;
                remaining?: number;
                hasMore?: boolean;
                error?: string;
              } = {};
              try {
                data = raw ? JSON.parse(raw) as typeof data : {};
              } catch {
                Alert.alert(
                  isRTL ? "خطأ" : "Error",
                  isRTL
                    ? `الخادم ردّ برد غير متوقع (${resp.status})`
                    : `Unexpected server response (${resp.status})`,
                );
                return;
              }
              if (!resp.ok || !data.success) {
                const detail = data.error
                  ?? (resp.status === 401 || resp.status === 403
                    ? (isRTL ? "غير مصرح — سجّل الدخول مجدداً" : "Unauthorized — sign in again")
                    : (isRTL ? `فشل الطلب (${resp.status})` : `Request failed (${resp.status})`));
                Alert.alert(isRTL ? "خطأ" : "Error", detail);
                return;
              }
              const moreHint = data.hasMore
                ? (isRTL ? `\nمتبقٍ: ${data.remaining} — اضغط مرة أخرى للمتابعة` : `\nRemaining: ${data.remaining} — run again to continue`)
                : "";
              const msg = isRTL
                ? `هذه الدفعة: ${data.total}\nتم التحديث: ${data.updated}\nتم التخطي: ${data.skipped}\nأخطاء: ${data.errors}${moreHint}`
                : `This batch: ${data.total}\nUpdated: ${data.updated}\nSkipped: ${data.skipped}\nErrors: ${data.errors}${moreHint}`;
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

  const quickActions: { icon: IconName; label: string; color: string; route: Href }[] = [
    { icon: "users", label: t("admin.users"), color: colors.secondary, route: "/(admin)/(tabs)/users" },
    { icon: "list", label: t("admin.orders"), color: colors.primary, route: "/(admin)/(tabs)/orders" },
    { icon: "credit-card", label: isRTL ? "المدفوعات" : "Payments", color: "#22A36B", route: "/(admin)/(tabs)/payments" },
    { icon: "alert-circle", label: isRTL ? "النزاعات" : "Disputes", color: "#C8880A", route: "/(admin)/(tabs)/disputes" },
    { icon: "book-open", label: isRTL ? "الأستاذ" : "Ledger", color: "#7C5CBF", route: "/(admin)/(tabs)/ledger" },
    { icon: "dollar-sign", label: isRTL ? "تسعير Lead" : "Lead Pricing", color: "#C8880A", route: "/(admin)/(tabs)/lead-pricing" },
    { icon: "shield", label: isRTL ? "التدقيق" : "Audit", color: "#22A36B", route: "/(admin)/(tabs)/audit-logs" },
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
        <TouchableOpacity
          style={[
            styles.accountCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
          onPress={() => router.push("/(admin)/(tabs)/profile")}
          activeOpacity={0.85}
        >
          <View style={[styles.accountAvatar, { backgroundColor: colors.primary + "22" }]}>
            <VectorIcon name="user" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
              {adminName}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
              {isRTL
                ? "الملف الشخصي · تسجيل الخروج · الخروج من كل الأجهزة"
                : "Profile · Sign out · Sign out other devices"}
            </Text>
          </View>
          <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

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
            { label: isRTL ? "في الانتظار" : "Pending", count: stats?.pendingOrders ?? 0, color: colors.primary },
            { label: isRTL ? "نشطة" : "Active", count: stats?.activeOrders ?? 0, color: colors.secondary },
            { label: isRTL ? "مكتملة" : "Completed", count: stats?.completedOrders ?? 0, color: colors.success },
          ].map((s, i) => (
            <View key={s.label} style={[styles.stripItem, { borderRightWidth: i < 2 ? 1 : 0, borderRightColor: colors.border }]}>
              <Text style={{ color: s.color, fontFamily: "Inter_700Bold", fontSize: 22 }}>{s.count}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        <AdminLiveMapPreview sessionToken={sessionToken} isRTL={isRTL} compact />

        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "آخر الطلبات" : "Recent Orders"}
        </Text>
        {recentOrders.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
            {t("common.noData")}
          </Text>
        ) : null}
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
              onPress={() => router.push(item.route)}
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
              {isRTL ? "دفعة حتى 20 فنيًا لكل تشغيل — كرّر إن بقي المزيد" : "Up to 20 techs per run — repeat if more remain"}
            </Text>
          </View>
          <VectorIcon name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolRow, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={() => router.push({ pathname: "/(admin)/(tabs)/map-dashboard", params: { mode: "live" } })}
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
          onPress={() => router.push({ pathname: "/(admin)/(tabs)/map-dashboard", params: { mode: "monitor" } })}
          activeOpacity={0.85}
        >
          <View style={[styles.toolIcon, { backgroundColor: "#7C5CBF18", borderRadius: 12 }]}>
            <VectorIcon name="eye" size={22} color="#7C5CBF" />
          </View>
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {isRTL ? "خريطة المراقبة" : "Monitoring Map"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
              {isRTL ? "تحديث كل 30 دقيقة" : "Refreshes every 30 minutes"}
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
  accountCard: { padding: 14, borderWidth: 1.5, alignItems: "center", marginBottom: 16 },
  accountAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
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
