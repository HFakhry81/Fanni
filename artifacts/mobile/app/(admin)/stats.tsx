import React, { useState } from "react";
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

export default function AdminStatsScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { allOrders } = useOrders();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const completed = allOrders.filter((o) => o.status === "completed");
  const totalRevenue = completed.reduce((sum, o) => sum + (o.invoice?.total ?? 0), 0);

  const catCounts: Record<string, number> = {};
  allOrders.forEach((o) => {
    catCounts[o.category] = (catCounts[o.category] ?? 0) + 1;
  });

  const topCategories = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const totalOrders = allOrders.length;
  const completionRate = totalOrders > 0 ? Math.round((completed.length / totalOrders) * 100) : 0;

  const barColors = ["#F5A623", "#0077CC", "#38A169", "#6C5CE7", "#E84393"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("admin.stats")}
        </Text>
      </View>

      {/* Period filter */}
      <View style={[styles.periodRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {(["week", "month", "year"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.periodBtn,
              { backgroundColor: period === p ? colors.primary : "transparent", borderRadius: colors.radius },
            ]}
            onPress={() => setPeriod(p)}
          >
            <Text style={{ color: period === p ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              {p === "week" ? (isRTL ? "أسبوع" : "Week") : p === "month" ? (isRTL ? "شهر" : "Month") : (isRTL ? "سنة" : "Year")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Summary cards */}
        <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 22 }}>
              {totalRevenue.toFixed(0)}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" }}>
              {t("admin.totalRevenue")} ({t("common.egp")})
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={{ color: colors.success, fontFamily: "Inter_700Bold", fontSize: 22 }}>
              {completionRate}%
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" }}>
              {isRTL ? "نسبة الإنجاز" : "Completion Rate"}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={{ color: "#0077CC", fontFamily: "Inter_700Bold", fontSize: 22 }}>
              {totalOrders}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" }}>
              {isRTL ? "إجمالي الطلبات" : "Total Orders"}
            </Text>
          </View>
        </View>

        {/* Category breakdown */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "توزيع الطلبات حسب الفئة" : "Orders by Category"}
        </Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          {topCategories.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }}>
              {t("common.noData")}
            </Text>
          ) : topCategories.map(([cat, count], idx) => {
            const percent = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
            return (
              <View key={cat} style={styles.barRow}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    width: 90,
                    textAlign: isRTL ? "right" : "left",
                  }}
                  numberOfLines={1}
                >
                  {t(`cat.${cat}`)}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(percent, 5)}%`, backgroundColor: barColors[idx % barColors.length] },
                    ]}
                  />
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, width: 32, textAlign: "right" }}>
                  {count}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Order status breakdown */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "حالة الطلبات" : "Order Status Breakdown"}
        </Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          {(["pending", "accepted", "inProgress", "completed", "cancelled"] as const).map((status, idx) => {
            const count = allOrders.filter((o) => o.status === status).length;
            const percent = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
            return (
              <View key={status} style={[styles.statusRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={[styles.statusDot, { backgroundColor: barColors[idx % barColors.length] }]} />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, textAlign: isRTL ? "right" : "left" }}>
                  {t(`order.status.${status}`)}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {count} ({percent.toFixed(0)}%)
                </Text>
              </View>
            );
          })}
        </View>

        {/* Top technicians */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "أفضل الفنيين" : "Top Technicians"}
        </Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
          {[
            { name: "طارق إبراهيم", orders: 15, rating: 4.9 },
            { name: "محمد علي", orders: 8, rating: 4.8 },
            { name: "خالد حسن", orders: 2, rating: 4.2 },
          ].map((tech, idx) => (
            <View key={tech.name} style={[styles.techRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 16, width: 28 }}>
                #{idx + 1}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1, textAlign: isRTL ? "right" : "left" }}>
                {tech.name}
              </Text>
              <View style={{ alignItems: isRTL ? "flex-start" : "flex-end" }}>
                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  {tech.rating}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                  {tech.orders} {isRTL ? "طلب" : "orders"}
                </Text>
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
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 22 },
  periodRow: { margin: 12, padding: 4, borderRadius: 12 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  summaryRow: { gap: 10, marginBottom: 24 },
  summaryCard: { flex: 1, alignItems: "center", paddingVertical: 16, borderWidth: 1.5 },
  sectionTitle: { fontSize: 18, marginBottom: 14 },
  chartCard: { padding: 16, marginBottom: 24, borderWidth: 1.5 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, minWidth: 8 },
  statusRow: { alignItems: "center", paddingVertical: 10, gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  techRow: { alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
});
