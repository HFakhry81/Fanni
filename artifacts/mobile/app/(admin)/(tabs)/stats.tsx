import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import VectorIcon, { type IconName } from "@/components/VectorIcon";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

type ReportView = "overview" | "pnl" | "balance" | "annual";
type Period = "week" | "month" | "year";

interface PnlData {
  period: { from: string; to: string };
  orderCount: number;
  totalLabour: number;
  technicianServiceFee: number;
  clientServiceFee: number;
  vatCollected: number;
  totalPlatformRevenue: number;
  netPlatformProfit: number;
  categoryBreakdown: { category: string; orderCount: number; revenue: number }[];
}

interface BalanceMonth {
  month: number;
  orderCount: number;
  revenue: number;
  serviceFees: number;
  vat: number;
  runningTotal: number;
}

interface BalanceData {
  year: number;
  months: BalanceMonth[];
  totalRevenue: number;
  categoryBreakdown: { category: string; revenue: number }[];
}

interface AnnualYear {
  year: number;
  orderCount: number;
  totalRevenue: number;
  avgRevenuePerOrder: number;
}

interface AnnualData {
  years: AnnualYear[];
}

const MONTH_NAMES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function AdminStatsScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { allOrders } = useOrders();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [view, setView] = useState<ReportView>("overview");
  const [period, setPeriod] = useState<Period>("month");

  // P&L state
  const [pnlData, setPnlData] = useState<PnlData | null>(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [pnlError, setPnlError] = useState<string | null>(null);
  const [pnlNoAccess, setPnlNoAccess] = useState(false);
  const [pnlCustomFrom, setPnlCustomFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [pnlCustomTo, setPnlCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Balance sheet state
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceNoAccess, setBalanceNoAccess] = useState(false);

  // Annual state
  const [annualData, setAnnualData] = useState<AnnualData | null>(null);
  const [annualLoading, setAnnualLoading] = useState(false);
  const [annualNoAccess, setAnnualNoAccess] = useState(false);
  const [annualFocusYear, setAnnualFocusYear] = useState(new Date().getFullYear());

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  }), [sessionToken]);

  const fetchPnl = useCallback(async (overridePeriod?: Period | string, customFrom?: string, customTo?: string) => {
    setPnlLoading(true);
    setPnlError(null);
    setPnlNoAccess(false);
    try {
      let url: string;
      if (customFrom && customTo) {
        url = `${getApiBase()}/api/admin/reports/pnl?from=${customFrom}&to=${customTo}`;
      } else {
        url = `${getApiBase()}/api/admin/reports/pnl?period=${overridePeriod ?? period}`;
      }
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 403) { setPnlNoAccess(true); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setPnlError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const data = await res.json() as PnlData;
      setPnlData(data);
    } catch {
      setPnlError(isRTL ? "تعذّر تحميل البيانات" : "Failed to load data");
    } finally {
      setPnlLoading(false);
    }
  }, [period, authHeaders, isRTL]);

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceNoAccess(false);
    try {
      const res = await fetch(
        `${getApiBase()}/api/admin/reports/balance-sheet?year=${balanceYear}`,
        { headers: authHeaders() }
      );
      if (res.status === 403) { setBalanceNoAccess(true); return; }
      if (res.ok) {
        const data = await res.json() as BalanceData;
        setBalanceData(data);
      }
    } catch {}
    setBalanceLoading(false);
  }, [balanceYear, authHeaders]);

  const fetchAnnual = useCallback(async () => {
    setAnnualLoading(true);
    setAnnualNoAccess(false);
    try {
      const res = await fetch(
        `${getApiBase()}/api/admin/reports/annual?to=${annualFocusYear}-12-31`,
        { headers: authHeaders() }
      );
      if (res.status === 403) { setAnnualNoAccess(true); return; }
      if (res.ok) {
        const data = await res.json() as AnnualData;
        setAnnualData(data);
      }
    } catch {}
    setAnnualLoading(false);
  }, [annualFocusYear, authHeaders]);

  useEffect(() => {
    if (view === "pnl") fetchPnl();
  }, [view, fetchPnl]);

  useEffect(() => {
    if (view === "balance") fetchBalance();
  }, [view, fetchBalance]);

  useEffect(() => {
    if (view === "annual") fetchAnnual();
  }, [view, fetchAnnual]);

  // ── Overview data ────────────────────────────────────────────────────────
  const completed = allOrders.filter((o) => o.status === "completed");
  const totalRevenue = completed.reduce((sum, o) => sum + (o.invoice?.total ?? 0), 0);
  const completionRate = allOrders.length > 0 ? Math.round((completed.length / allOrders.length) * 100) : 0;
  const catCounts: Record<string, number> = {};
  allOrders.forEach((o) => { catCounts[o.category] = (catCounts[o.category] ?? 0) + 1; });
  const topCats = Object.entries(catCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
  const barColors = [colors.primary, colors.secondary, "#22A36B", "#7C5CBF", "#E67E22"];

  // ── Export helpers ────────────────────────────────────────────────────────
  const exportPnlPdf = async () => {
    if (!pnlData) return;
    const dir = isRTL ? "rtl" : "ltr";
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:32px;color:#111;direction:${dir}}h1{font-size:20px;color:#F59E0B}h2{font-size:15px;color:#555;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-bottom:24px}th{background:#FEF3C7;padding:10px;text-align:left}td{padding:10px;border-bottom:1px solid #eee}.total{font-weight:700;font-size:16px;color:#D97706}</style></head>
<body>
<h1>${isRTL ? "تقرير الأرباح والخسائر" : "Profit & Loss Report"}</h1>
<h2>${isRTL ? "الفترة" : "Period"}: ${new Date(pnlData.period.from).toLocaleDateString()} – ${new Date(pnlData.period.to).toLocaleDateString()}</h2>
<table>
<tr><th>${isRTL ? "البند" : "Line Item"}</th><th>${isRTL ? "المبلغ (ج.م)" : "Amount (EGP)"}</th></tr>
<tr><td>${isRTL ? "رسوم الخدمة – الفني (15%)" : "Technician Service Fee (15%)"}</td><td>${fmt(pnlData.technicianServiceFee)}</td></tr>
<tr><td>${isRTL ? "رسوم الخدمة – العميل (15%)" : "Client Service Fee (15%)"}</td><td>${fmt(pnlData.clientServiceFee)}</td></tr>
<tr><td>${isRTL ? "ضريبة القيمة المضافة (14%)" : "VAT Collected (14%)"}</td><td>${fmt(pnlData.vatCollected)}</td></tr>
<tr><td class="total">${isRTL ? "إجمالي إيرادات المنصة" : "Total Platform Revenue"}</td><td class="total">${fmt(pnlData.totalPlatformRevenue)}</td></tr>
<tr><td class="total">${isRTL ? "صافي ربح المنصة" : "Net Platform Profit"}</td><td class="total">${fmt(pnlData.netPlatformProfit)}</td></tr>
</table>
<h2>${isRTL ? "توزيع حسب الفئة" : "Category Breakdown"}</h2>
<table>
<tr><th>${isRTL ? "الفئة" : "Category"}</th><th>${isRTL ? "الطلبات" : "Orders"}</th><th>${isRTL ? "الإيرادات (ج.م)" : "Revenue (EGP)"}</th></tr>
${pnlData.categoryBreakdown.map((c) => `<tr><td>${c.category}</td><td>${c.orderCount}</td><td>${fmt(c.revenue)}</td></tr>`).join("")}
</table>
</body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch { Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل التصدير" : "Export failed"); }
  };

  const exportPnlCsv = async () => {
    if (!pnlData) return;
    const rows = [
      ["Item", "Amount (EGP)"],
      ["Technician Service Fee (15%)", pnlData.technicianServiceFee.toFixed(2)],
      ["Client Service Fee (15%)", pnlData.clientServiceFee.toFixed(2)],
      ["VAT Collected (14%)", pnlData.vatCollected.toFixed(2)],
      ["Total Platform Revenue", pnlData.totalPlatformRevenue.toFixed(2)],
      ["Net Platform Profit", pnlData.netPlatformProfit.toFixed(2)],
      [],
      ["Category", "Orders", "Revenue (EGP)"],
      ...pnlData.categoryBreakdown.map((c) => [c.category, c.orderCount.toString(), c.revenue.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    try {
      if (Platform.OS === "web") {
        Alert.alert(isRTL ? "تنبيه" : "Note", isRTL ? "استخدم تصدير PDF على الويب" : "Use PDF export on web");
        return;
      }
      const path = `${FileSystem.cacheDirectory}pnl_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(path, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
    } catch { Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل التصدير" : "Export failed"); }
  };

  const exportBalancePdf = async () => {
    if (!balanceData) return;
    const dir = isRTL ? "rtl" : "ltr";
    const monthNames = isRTL ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:32px;color:#111;direction:${dir}}h1{font-size:20px;color:#F59E0B}table{width:100%;border-collapse:collapse;margin-bottom:24px}th{background:#FEF3C7;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #eee}.total{font-weight:700;color:#D97706}</style></head>
<body>
<h1>${isRTL ? `الميزانية العمومية ${balanceData.year}` : `Balance Sheet ${balanceData.year}`}</h1>
<table>
<tr><th>${isRTL ? "الشهر" : "Month"}</th><th>${isRTL ? "الطلبات" : "Orders"}</th><th>${isRTL ? "الإيرادات (ج.م)" : "Revenue (EGP)"}</th><th>${isRTL ? "الإجمالي التراكمي (ج.م)" : "Running Total (EGP)"}</th></tr>
${balanceData.months.map((m) => `<tr><td>${monthNames[m.month - 1]}</td><td>${m.orderCount}</td><td>${fmt(m.revenue)}</td><td>${fmt(m.runningTotal)}</td></tr>`).join("")}
<tr class="total"><td colspan="2">${isRTL ? "الإجمالي" : "Total"}</td><td>${fmt(balanceData.totalRevenue)}</td><td>${fmt(balanceData.totalRevenue)}</td></tr>
</table>
</body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch { Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل التصدير" : "Export failed"); }
  };

  const exportBalanceCsv = async () => {
    if (!balanceData) return;
    const monthNames = MONTH_NAMES_EN;
    const rows = [
      ["Month", "Orders", "Revenue (EGP)", "Running Total (EGP)"],
      ...balanceData.months.map((m) => [monthNames[m.month - 1] ?? "", m.orderCount.toString(), m.revenue.toFixed(2), m.runningTotal.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    try {
      if (Platform.OS === "web") {
        Alert.alert(isRTL ? "تنبيه" : "Note", isRTL ? "استخدم تصدير PDF على الويب" : "Use PDF export on web");
        return;
      }
      const path = `${FileSystem.cacheDirectory}balance_${balanceData.year}_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(path, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
    } catch { Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل التصدير" : "Export failed"); }
  };

  const exportAnnualPdf = async () => {
    if (!annualData) return;
    const dir = isRTL ? "rtl" : "ltr";
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:32px;color:#111;direction:${dir}}h1{font-size:20px;color:#F59E0B}table{width:100%;border-collapse:collapse;margin-bottom:24px}th{background:#FEF3C7;padding:10px;text-align:left}td{padding:10px;border-bottom:1px solid #eee}</style></head>
<body>
<h1>${isRTL ? "التقرير السنوي" : "Annual Report"}</h1>
<table>
<tr><th>${isRTL ? "السنة" : "Year"}</th><th>${isRTL ? "الطلبات" : "Orders"}</th><th>${isRTL ? "الإيرادات (ج.م)" : "Revenue (EGP)"}</th><th>${isRTL ? "متوسط الإيراد (ج.م)" : "Avg Revenue (EGP)"}</th></tr>
${annualData.years.map((y) => `<tr><td>${y.year}</td><td>${y.orderCount}</td><td>${fmt(y.totalRevenue)}</td><td>${fmt(y.avgRevenuePerOrder)}</td></tr>`).join("")}
</table>
</body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch { Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل التصدير" : "Export failed"); }
  };

  const exportAnnualCsv = async () => {
    if (!annualData) return;
    const rows = [
      ["Year", "Orders", "Revenue (EGP)", "Avg Revenue (EGP)"],
      ...annualData.years.map((y) => [y.year.toString(), y.orderCount.toString(), y.totalRevenue.toFixed(2), y.avgRevenuePerOrder.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    try {
      if (Platform.OS === "web") {
        Alert.alert(isRTL ? "تنبيه" : "Note", isRTL ? "استخدم تصدير PDF على الويب" : "Use PDF export on web");
        return;
      }
      const path = `${FileSystem.cacheDirectory}annual_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(path, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
    } catch { Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل التصدير" : "Export failed"); }
  };

  // ── View selector tabs ─────────────────────────────────────────────────
  const views: { key: ReportView; en: string; ar: string; icon: IconName }[] = [
    { key: "overview", en: "Overview", ar: "نظرة عامة", icon: "bar-chart-2" },
    { key: "pnl",      en: "P&L",      ar: "أرباح/خسائر", icon: "trending-up" },
    { key: "balance",  en: "Balance",  ar: "الميزانية",  icon: "layers" },
    { key: "annual",   en: "Annual",   ar: "سنوي",       icon: "calendar" },
  ];

  const periods = [
    { key: "week"  as Period, ar: "أسبوع", en: "Week"  },
    { key: "month" as Period, ar: "شهر",   en: "Month" },
    { key: "year"  as Period, ar: "سنة",   en: "Year"  },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("admin.stats")} showHome showLogout />

      {/* View switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.viewSwitcher, { backgroundColor: colors.card }]}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, gap: 6, flexDirection: isRTL ? "row-reverse" : "row" }}
      >
        {views.map((v) => (
          <TouchableOpacity
            key={v.key}
            style={[styles.viewBtn, { backgroundColor: view === v.key ? colors.primary : "transparent", borderRadius: colors.radius - 4 }]}
            onPress={() => setView(v.key)}
          >
            <VectorIcon name={v.icon} size={13} color={view === v.key ? "#FFF" : colors.mutedForeground} />
            <Text style={{ color: view === v.key ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>
              {isRTL ? v.ar : v.en}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── OVERVIEW ───────────────────────────────────────────────────── */}
      {view === "overview" && (
        <>
          <View style={[styles.periodRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {periods.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodBtn, { backgroundColor: period === p.key ? colors.secondary : "transparent", borderRadius: colors.radius - 4 }]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={{ color: period === p.key ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {isRTL ? p.ar : p.en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
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
          </ScrollView>
        </>
      )}

      {/* ── P&L ────────────────────────────────────────────────────────── */}
      {view === "pnl" && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.viewSwitcher, { backgroundColor: colors.card }]}
            contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 4, gap: 4, flexDirection: isRTL ? "row-reverse" : "row" }}
          >
            {periods.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodBtn, { backgroundColor: period === p.key && !showCustomPicker ? colors.primary : "transparent", borderRadius: colors.radius - 4 }]}
                onPress={() => {
                  setShowCustomPicker(false);
                  setPeriod(p.key);
                  fetchPnl(p.key);
                }}
              >
                <Text style={{ color: period === p.key && !showCustomPicker ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {isRTL ? p.ar : p.en}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.periodBtn, { backgroundColor: showCustomPicker ? colors.primary : "transparent", borderRadius: colors.radius - 4 }]}
              onPress={() => setShowCustomPicker((v) => !v)}
            >
              <Text style={{ color: showCustomPicker ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                {isRTL ? "مخصص" : "Custom"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
          {showCustomPicker && (
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card, alignItems: "center" }}>
              <TextInput
                value={pnlCustomFrom}
                onChangeText={setPnlCustomFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground, backgroundColor: colors.background, textAlign: isRTL ? "right" : "left" }}
              />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>→</Text>
              <TextInput
                value={pnlCustomTo}
                onChangeText={setPnlCustomTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground, backgroundColor: colors.background, textAlign: isRTL ? "right" : "left" }}
              />
              <TouchableOpacity
                onPress={() => fetchPnl(undefined, pnlCustomFrom, pnlCustomTo)}
                style={{ backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 }}
              >
                <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{isRTL ? "تطبيق" : "Apply"}</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
            {pnlNoAccess ? (
              <View style={[styles.accessBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <VectorIcon name="lock" size={18} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14, marginLeft: 10, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "ليس لديك صلاحية عرض التقارير المالية" : "You don't have permission to view financial reports"}
                </Text>
              </View>
            ) : pnlLoading ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : pnlError ? (
              <View style={[styles.accessBanner, { backgroundColor: "#FFE6E6", borderColor: colors.destructive }]}>
                <VectorIcon name="alert-circle" size={18} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: "Inter_500Medium", fontSize: 14, marginLeft: 10 }}>{pnlError}</Text>
                <TouchableOpacity onPress={() => fetchPnl()} style={{ marginLeft: "auto" }}>
                  <VectorIcon name="refresh-cw" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : pnlData ? (
              <>
                {/* Export buttons */}
                <View style={[styles.exportRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <TouchableOpacity style={[styles.exportBtn, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]} onPress={exportPnlPdf}>
                    <VectorIcon name="file-text" size={14} color="#D97706" />
                    <Text style={{ color: "#D97706", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.exportBtn, { backgroundColor: "#D1FAE5", borderColor: "#22A36B" }]} onPress={exportPnlCsv}>
                    <VectorIcon name="download" size={14} color="#22A36B" />
                    <Text style={{ color: "#22A36B", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>CSV</Text>
                  </TouchableOpacity>
                </View>

                {/* P&L rows */}
                <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4, textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? "بيان الأرباح والخسائر" : "Profit & Loss Statement"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 14, textAlign: isRTL ? "right" : "left" }}>
                    {new Date(pnlData.period.from).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                    {" – "}
                    {new Date(pnlData.period.to).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </Text>
                  {[
                    { label: isRTL ? "رسوم الخدمة – الفني (15%)" : "Technician Service Fee (15%)", value: pnlData.technicianServiceFee, color: "#F59E0B" },
                    { label: isRTL ? "رسوم الخدمة – العميل (15%)" : "Client Service Fee (15%)", value: pnlData.clientServiceFee, color: "#7C5CBF" },
                    { label: isRTL ? "ضريبة القيمة المضافة (14%)" : "VAT Collected (14%)", value: pnlData.vatCollected, color: "#22A36B" },
                  ].map((row) => (
                    <View key={row.label} style={[styles.pnlRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                      <View style={[styles.pnlDot, { backgroundColor: row.color }]} />
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
                        {row.label}
                      </Text>
                      <Text style={{ color: row.color, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                        {fmt(row.value)} {t("common.egp")}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.totalRow, { backgroundColor: colors.accent, borderRadius: colors.radius - 4, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL ? "إجمالي إيرادات المنصة" : "Total Platform Revenue"}
                    </Text>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {fmt(pnlData.totalPlatformRevenue)} {t("common.egp")}
                    </Text>
                  </View>
                  <View style={[styles.totalRow, { backgroundColor: "#D1FAE5", borderRadius: colors.radius - 4, marginTop: 6, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: "#22A36B", fontFamily: "Inter_700Bold", fontSize: 15, flex: 1, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL ? "صافي ربح المنصة" : "Net Platform Profit"}
                    </Text>
                    <Text style={{ color: "#22A36B", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {fmt(pnlData.netPlatformProfit)} {t("common.egp")}
                    </Text>
                  </View>
                  <View style={[styles.metaRow2, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <VectorIcon name="shopping-cart" size={13} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: 5 }}>
                      {pnlData.orderCount} {isRTL ? "طلب مكتمل" : "completed orders"}
                    </Text>
                  </View>
                </View>

                {/* Category breakdown */}
                {pnlData.categoryBreakdown.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                      {isRTL ? "الإيرادات حسب الفئة" : "Revenue by Category"}
                    </Text>
                    <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
                      {pnlData.categoryBreakdown.map((c, idx) => {
                        const pct = pnlData.totalPlatformRevenue > 0 ? (c.revenue / pnlData.totalPlatformRevenue) * 100 : 0;
                        return (
                          <View key={c.category} style={styles.barRow}>
                            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, width: 85, textAlign: isRTL ? "right" : "left" }} numberOfLines={1}>
                              {c.category}
                            </Text>
                            <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                              <View style={[styles.barFill, { width: `${Math.max(pct, 5)}%`, backgroundColor: barColors[idx % barColors.length] }]} />
                            </View>
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, width: 50, textAlign: "right" }}>{fmt(c.revenue)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            ) : null}
          </ScrollView>
        </>
      )}

      {/* ── BALANCE SHEET ───────────────────────────────────────────────── */}
      {view === "balance" && (
        <>
          {/* Year selector */}
          <View style={[styles.periodRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              onPress={() => setBalanceYear((y) => y - 1)}
              style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <VectorIcon name="chevron-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1, textAlign: "center" }}>{balanceYear}</Text>
            <TouchableOpacity
              onPress={() => setBalanceYear((y) => Math.min(y + 1, currentYear))}
              style={{ paddingHorizontal: 16, paddingVertical: 8 }}
              disabled={balanceYear >= currentYear}
            >
              <VectorIcon name="chevron-right" size={20} color={balanceYear >= currentYear ? colors.border : colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
            {balanceLoading ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : balanceNoAccess ? (
              <View style={[styles.accessBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <VectorIcon name="lock" size={18} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14, marginLeft: 10, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "ليس لديك صلاحية عرض التقارير المالية" : "You don't have permission to view financial reports"}
                </Text>
              </View>
            ) : balanceData ? (
              <>
                {/* Export buttons */}
                <View style={[styles.exportRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <TouchableOpacity style={[styles.exportBtn, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]} onPress={exportBalancePdf}>
                    <VectorIcon name="file-text" size={14} color="#D97706" />
                    <Text style={{ color: "#D97706", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.exportBtn, { backgroundColor: "#D1FAE5", borderColor: "#22A36B" }]} onPress={exportBalanceCsv}>
                    <VectorIcon name="download" size={14} color="#22A36B" />
                    <Text style={{ color: "#22A36B", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>CSV</Text>
                  </TouchableOpacity>
                </View>

                {/* Summary card */}
                <View style={[styles.totalCard, { backgroundColor: colors.accent, borderRadius: colors.radius }]}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                    {isRTL ? `إجمالي إيرادات ${balanceData.year}` : `Total Revenue ${balanceData.year}`}
                  </Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 28, marginTop: 4 }}>
                    {fmt(balanceData.totalRevenue)} <Text style={{ fontSize: 14 }}>{t("common.egp")}</Text>
                  </Text>
                </View>

                {/* Monthly table */}
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                  {isRTL ? "الأرباح الشهرية التراكمية" : "Monthly Cumulative Earnings"}
                </Text>
                <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, padding: 0, overflow: "hidden" }]}>
                  {/* Header */}
                  <View style={[styles.tableHeader, { backgroundColor: colors.muted, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={[styles.thCell, { color: colors.mutedForeground, flex: 1.2 }]}>{isRTL ? "الشهر" : "Month"}</Text>
                    <Text style={[styles.thCell, { color: colors.mutedForeground }]}>{isRTL ? "طلبات" : "Orders"}</Text>
                    <Text style={[styles.thCell, { color: colors.mutedForeground }]}>{isRTL ? "الإيراد" : "Revenue"}</Text>
                    <Text style={[styles.thCell, { color: colors.mutedForeground }]}>{isRTL ? "تراكمي" : "Running"}</Text>
                  </View>
                  {balanceData.months.map((m, idx) => {
                    const monthNames = isRTL ? MONTH_NAMES_AR : MONTH_NAMES_EN;
                    const hasData = m.revenue > 0;
                    return (
                      <View
                        key={m.month}
                        style={[styles.tableRow, {
                          backgroundColor: idx % 2 === 0 ? colors.background : colors.card,
                          flexDirection: isRTL ? "row-reverse" : "row",
                        }]}
                      >
                        <Text style={[styles.tdCell, { color: hasData ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold", flex: 1.2 }]}>
                          {monthNames[m.month - 1]}
                        </Text>
                        <Text style={[styles.tdCell, { color: colors.mutedForeground }]}>{m.orderCount}</Text>
                        <Text style={[styles.tdCell, { color: hasData ? colors.primary : colors.mutedForeground }]}>{fmt(m.revenue)}</Text>
                        <Text style={[styles.tdCell, { color: hasData ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{fmt(m.runningTotal)}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Category breakdown */}
                {balanceData.categoryBreakdown.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                      {isRTL ? "توزيع حسب الفئة" : "By Service Category"}
                    </Text>
                    <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
                      {balanceData.categoryBreakdown.map((c, idx) => {
                        const pct = balanceData.totalRevenue > 0 ? (c.revenue / balanceData.totalRevenue) * 100 : 0;
                        return (
                          <View key={c.category} style={styles.barRow}>
                            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, width: 85 }} numberOfLines={1}>{c.category}</Text>
                            <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                              <View style={[styles.barFill, { width: `${Math.max(pct, 5)}%`, backgroundColor: barColors[idx % barColors.length] }]} />
                            </View>
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, width: 50, textAlign: "right" }}>{pct.toFixed(0)}%</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            ) : null}
          </ScrollView>
        </>
      )}

      {/* ── ANNUAL REPORT ───────────────────────────────────────────────── */}
      {view === "annual" && (
        <>
          {/* Year selector */}
          <View style={[styles.periodRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              onPress={() => setAnnualFocusYear((y) => y - 1)}
              style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <VectorIcon name="chevron-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, flex: 1, textAlign: "center" }}>{annualFocusYear}</Text>
            <TouchableOpacity
              onPress={() => setAnnualFocusYear((y) => Math.min(y + 1, currentYear))}
              style={{ paddingHorizontal: 16, paddingVertical: 8 }}
              disabled={annualFocusYear >= currentYear}
            >
              <VectorIcon name="chevron-right" size={20} color={annualFocusYear >= currentYear ? colors.border : colors.foreground} />
            </TouchableOpacity>
          </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
          {annualLoading ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : annualNoAccess ? (
            <View style={[styles.accessBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <VectorIcon name="lock" size={18} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14, marginLeft: 10, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "ليس لديك صلاحية عرض التقارير المالية" : "You don't have permission to view financial reports"}
              </Text>
            </View>
          ) : annualData ? (
            <>
              {/* Export buttons */}
              <View style={[styles.exportRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]} onPress={exportAnnualPdf}>
                  <VectorIcon name="file-text" size={14} color="#D97706" />
                  <Text style={{ color: "#D97706", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: "#D1FAE5", borderColor: "#22A36B" }]} onPress={exportAnnualCsv}>
                  <VectorIcon name="download" size={14} color="#22A36B" />
                  <Text style={{ color: "#22A36B", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>CSV</Text>
                </TouchableOpacity>
              </View>

              {(() => {
                const displayedYears = annualData.years.filter((y) => y.year <= annualFocusYear);
                if (displayedYears.length === 0) return (
                  <View style={{ alignItems: "center", paddingTop: 40 }}>
                    <VectorIcon name="bar-chart-2" size={48} color={colors.border} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 12 }}>
                      {isRTL ? "لا توجد بيانات لهذه السنة" : `No data up to ${annualFocusYear}`}
                    </Text>
                  </View>
                );
                return (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "مقارنة سنة بسنة" : "Year-over-Year Comparison"}
                  </Text>

                  {/* Bar chart: Total Revenue */}
                  <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 14, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL ? "إجمالي الإيرادات (ج.م)" : "Total Revenue (EGP)"}
                    </Text>
                    {displayedYears.map((y, idx) => {
                      const maxRev = Math.max(...displayedYears.map((yy) => yy.totalRevenue), 1);
                      const pct = (y.totalRevenue / maxRev) * 100;
                      return (
                        <View key={y.year} style={styles.barRow}>
                          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, width: 46, textAlign: isRTL ? "right" : "left" }}>
                            {y.year}
                          </Text>
                          <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                            <View style={[styles.barFill, { width: `${Math.max(pct, 5)}%`, backgroundColor: barColors[idx % barColors.length] }]} />
                          </View>
                          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12, width: 60, textAlign: "right" }}>
                            {fmt(y.totalRevenue)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Bar chart: Order Count */}
                  <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 14, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL ? "عدد الطلبات المكتملة" : "Completed Orders Count"}
                    </Text>
                    {displayedYears.map((y, idx) => {
                      const maxOrders = Math.max(...displayedYears.map((yy) => yy.orderCount), 1);
                      const pct = (y.orderCount / maxOrders) * 100;
                      return (
                        <View key={y.year} style={styles.barRow}>
                          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, width: 46 }}>{y.year}</Text>
                          <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                            <View style={[styles.barFill, { width: `${Math.max(pct, 5)}%`, backgroundColor: barColors[(idx + 1) % barColors.length] }]} />
                          </View>
                          <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold", fontSize: 12, width: 40, textAlign: "right" }}>{y.orderCount}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Bar chart: Avg Revenue per Order */}
                  <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 14, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL ? "متوسط الإيراد لكل طلب (ج.م)" : "Avg Revenue per Order (EGP)"}
                    </Text>
                    {displayedYears.map((y, idx) => {
                      const maxAvg = Math.max(...displayedYears.map((yy) => yy.avgRevenuePerOrder), 1);
                      const pct = (y.avgRevenuePerOrder / maxAvg) * 100;
                      return (
                        <View key={y.year} style={styles.barRow}>
                          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, width: 46 }}>{y.year}</Text>
                          <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                            <View style={[styles.barFill, { width: `${Math.max(pct, 5)}%`, backgroundColor: barColors[(idx + 2) % barColors.length] }]} />
                          </View>
                          <Text style={{ color: "#22A36B", fontFamily: "Inter_700Bold", fontSize: 12, width: 60, textAlign: "right" }}>
                            {fmt(y.avgRevenuePerOrder)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Summary table */}
                  <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "ملخص سنوي" : "Annual Summary"}
                  </Text>
                  <View style={[styles.chartCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, padding: 0, overflow: "hidden" }]}>
                    <View style={[styles.tableHeader, { backgroundColor: colors.muted, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                      <Text style={[styles.thCell, { color: colors.mutedForeground }]}>{isRTL ? "السنة" : "Year"}</Text>
                      <Text style={[styles.thCell, { color: colors.mutedForeground }]}>{isRTL ? "طلبات" : "Orders"}</Text>
                      <Text style={[styles.thCell, { color: colors.mutedForeground }]}>{isRTL ? "الإيرادات" : "Revenue"}</Text>
                      <Text style={[styles.thCell, { color: colors.mutedForeground }]}>{isRTL ? "المتوسط" : "Avg/Order"}</Text>
                    </View>
                    {displayedYears.map((y, idx) => (
                      <View key={y.year} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? colors.background : colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                        <Text style={[styles.tdCell, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{y.year}</Text>
                        <Text style={[styles.tdCell, { color: colors.mutedForeground }]}>{y.orderCount}</Text>
                        <Text style={[styles.tdCell, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{fmt(y.totalRevenue)}</Text>
                        <Text style={[styles.tdCell, { color: "#22A36B" }]}>{fmt(y.avgRevenuePerOrder)}</Text>
                      </View>
                    ))}
                  </View>
                </>
                );
              })()}
            </>
          ) : null}
        </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  viewSwitcher: { maxHeight: 56 },
  viewBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8 },
  periodRow: { margin: 12, padding: 4, borderRadius: 14, flexDirection: "row", alignItems: "center" },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  summaryRow: { gap: 10, marginBottom: 24 },
  summaryCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  sectionTitle: { fontSize: 16, marginBottom: 12, marginTop: 4 },
  chartCard: { padding: 16, marginBottom: 20, borderWidth: 1.5 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 8 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  statusRow: { alignItems: "center", paddingVertical: 10, gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  exportRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  exportBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5 },
  accessBanner: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  pnlRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  pnlDot: { width: 10, height: 10, borderRadius: 5 },
  totalRow: { flexDirection: "row", alignItems: "center", padding: 14, marginTop: 8 },
  metaRow2: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 5 },
  totalCard: { padding: 20, marginBottom: 20, alignItems: "center" },
  tableHeader: { paddingVertical: 10, paddingHorizontal: 12 },
  tableRow: { paddingVertical: 10, paddingHorizontal: 12 },
  thCell: { fontFamily: "Inter_600SemiBold", fontSize: 11, flex: 1, textAlign: "center" },
  tdCell: { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, textAlign: "center", color: "#111" },
});
