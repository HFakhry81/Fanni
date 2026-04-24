import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import AppHeader from "@/components/AppHeader";

export default function AdminStatsScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { allOrders } = useOrders();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  const completed = allOrders.filter((o) => o.status === "completed");
  const totalRevenue = completed.reduce((sum, o) => sum + (o.invoice?.total ?? 0), 0);
  const completionRate = allOrders.length > 0 ? Math.round((completed.length / allOrders.length) * 100) : 0;

  const catCounts: Record<string, number> = {};
  allOrders.forEach((o) => { catCounts[o.category] = (catCounts[o.category] ?? 0) + 1; });
  const topCats = Object.entries(catCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

  const barColors = [colors.primary, colors.secondary, "#22A36B", "#7C5CBF", "#E67E22"];

  const periods = [
    { key: "week", ar: "أسبوع", en: "Week" },
    { key: "month", ar: "شهر", en: "Month" },
    { key: "year", ar: "سنة", en: "Year" },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("admin.stats")} showHome showLogout />

      {/* Period */}
      <View style={[styles.periodRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, { backgroundColor: period === p.key ? colors.primary : "transparent", borderRadius: colors.radius - 4 }]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={{ color: period === p.key ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {isRTL ? p.ar : p.en}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Summary cards */}
        <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            { label: `${t("admin.totalRevenue")} (${t("common.egp")})`, value: totalRevenue.toFixed(0), color: colors.primary,   bg: colors.accent },
            { label: isRTL ? "نسبة الإنجاز" : "Completion",             value: `${completionRate}%`,    color: colors.success,   bg: "#D4EDDA" },
            { label: isRTL ? "إجمالي الطلبات" : "Total Orders",          value: allOrders.length.toString(), color: colors.secondary, bg: colors.accentBlue },
          ].map((s) => (
            <View key={s.label} style={[styles.summaryCard, { backgroundColor: s.bg, borderRadius: colors.radius }]}>
              <Text style={{ color: s.color, fontFamily: "Inter_700Bold", fontSize: 22 }}>{s.value}</Text>
              <Text style={{ color: s.color, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 4, opacity: 0.8 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Category breakdown */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "توزيع الطلبات حسب الفئة" : "Orders by Category"}
        </Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          {topCats.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>{t("common.noData")}</Text>
          ) : topCats.map(([cat, count], idx) => {
            const pct = allOrders.length > 0 ? (count / allOrders.length) * 100 : 0;
            return (
              <View key={cat} style={styles.barRow}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, width: 85, textAlign: isRTL ? "right" : "left" }} numberOfLines={1}>
                  {t(`cat.${cat}`)}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                  <View style={[styles.barFill, { width: `${Math.max(pct, 5)}%`, backgroundColor: barColors[idx % barColors.length] }]} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12, width: 26, textAlign: "right" }}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Status breakdown */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "حالة الطلبات" : "Order Status Breakdown"}
        </Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          {(["pending", "accepted", "inProgress", "completed", "cancelled"] as const).map((status, idx) => {
            const count = allOrders.filter((o) => o.status === status).length;
            const pct = allOrders.length > 0 ? (count / allOrders.length) * 100 : 0;
            return (
              <View key={status} style={[styles.statusRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={[styles.statusDot, { backgroundColor: barColors[idx % barColors.length] }]} />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, textAlign: isRTL ? "right" : "left" }}>
                  {t(`order.status.${status}`)}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {count} ({pct.toFixed(0)}%)
                </Text>
              </View>
            );
          })}
        </View>

        {/* Top techs */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "أفضل الفنيين" : "Top Technicians"}
        </Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          {[
            { name: "طارق إبراهيم", orders: 15, rating: 4.9 },
            { name: "محمد علي",     orders: 8,  rating: 4.8 },
            { name: "خالد حسن",    orders: 2,  rating: 4.2 },
          ].map((tech, idx) => (
            <View key={tech.name} style={[styles.techRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? colors.accent : colors.muted }]}>
                <Text style={{ color: idx === 0 ? colors.primary : colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>#{idx + 1}</Text>
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
                {tech.name}
              </Text>
              <View style={{ alignItems: isRTL ? "flex-start" : "flex-end" }}>
                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>⭐ {tech.rating}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>{tech.orders} {isRTL ? "طلب" : "orders"}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  periodRow: { margin: 12, padding: 4, borderRadius: 14 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  summaryRow: { gap: 10, marginBottom: 24 },
  summaryCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  chartCard: { padding: 16, marginBottom: 24, borderWidth: 1.5 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  statusRow: { alignItems: "center", paddingVertical: 10, gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  techRow: { alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  rankBadge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
