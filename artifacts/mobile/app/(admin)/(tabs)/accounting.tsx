import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import VectorIcon from "@/components/VectorIcon";
import { getApiBase } from "@/utils/api";

interface AccountingSummary {
  confirmed_count: string;
  pending_count: string;
  rejected_count: string;
  total_cash_egp: string;
  total_points_issued: string;
}

interface TxSummary {
  total_cash_from_transactions: string;
  total_gateway_fees: string;
  pts_purchased: string;
  pts_unlocked: string;
  pts_refunded: string;
  pts_bonus: string;
  pts_adjusted: string;
}

interface DailyRow {
  day: string;
  confirmed: string;
  cash_egp: string;
  points_issued: string;
}

interface MethodRow {
  payment_method: string;
  total_requests: string;
  confirmed: string;
  cash_egp: string;
}

interface AccountingData {
  period: { from: string; to: string };
  summary: AccountingSummary;
  txSummary: TxSummary;
  daily: DailyRow[];
  byMethod: MethodRow[];
}

const METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  bank_transfer: { ar: "تحويل بنكي", en: "Bank Transfer" },
  instapay: { ar: "إنستا باي", en: "InstaPay" },
  e_wallet: { ar: "محفظة إلكترونية", en: "E-Wallet" },
};

function fmtEgp(v: string | number | undefined) {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "0.00" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPts(v: string | number | undefined) {
  const n = parseInt(String(v ?? 0));
  return isNaN(n) ? "0" : n.toLocaleString();
}
function fmtNum(v: string | number | undefined) {
  const n = parseInt(String(v ?? 0));
  return isNaN(n) ? "0" : n.toLocaleString();
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthAgoStr() {
  const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10);
}

export default function AdminAccountingScreen() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [appliedFrom, setAppliedFrom] = useState(monthAgoStr());
  const [appliedTo, setAppliedTo] = useState(todayStr());
  const [showFilter, setShowFilter] = useState(false);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    }),
    [sessionToken],
  );

  const fetchData = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${getApiBase()}/api/admin/accounting/points?from=${f}&to=${t}`,
        { headers: authHeaders() },
      );
      if (!res.ok) { setError(`HTTP ${res.status}`); return; }
      const json = await res.json() as AccountingData;
      setData(json);
    } catch {
      setError(isRTL ? "فشل التحميل" : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, isRTL]);

  useFocusEffect(useCallback(() => { fetchData(appliedFrom, appliedTo); }, [fetchData, appliedFrom, appliedTo]));

  const summary = data?.summary;
  const tx = data?.txSummary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={isRTL ? "تقارير الحسابات" : "Accounting Reports"} showHome showLogout />

      {/* Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.filterToggle, { borderColor: colors.border }]}
          onPress={() => setShowFilter((v) => !v)}
        >
          <VectorIcon name="settings" size={14} color={colors.primary} />
          <Text style={[styles.filterToggleText, { color: colors.primary }]}>
            {isRTL ? "الفترة الزمنية" : "Period"}
          </Text>
          <VectorIcon name={showFilter ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>
          {appliedFrom} → {appliedTo}
        </Text>
      </View>

      {showFilter && (
        <View style={[styles.filterPanel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.dateRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={styles.dateField}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>{isRTL ? "من" : "From"}</Text>
              <TextInput
                style={[styles.dateInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>{isRTL ? "إلى" : "To"}</Text>
              <TextInput
                style={[styles.dateInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              onPress={() => { setAppliedFrom(from); setAppliedTo(to); setShowFilter(false); }}
            >
              <Text style={styles.applyBtnText}>{isRTL ? "تطبيق" : "Apply"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <VectorIcon name="alert-circle" size={36} color={colors.destructive} />
          <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 14 }}>{error}</Text>
          <TouchableOpacity onPress={() => fetchData(appliedFrom, appliedTo)} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
              {isRTL ? "إعادة المحاولة" : "Retry"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 16, paddingBottom: botPad + 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Revenue summary ── */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "إيرادات الاشتراكات" : "Subscription Revenue"}
          </Text>
          <View style={[styles.cardsGrid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {[
              {
                label: isRTL ? "إجمالي المحصّل" : "Total Collected",
                value: `${fmtEgp(summary?.total_cash_egp)} ${isRTL ? "ج.م" : "EGP"}`,
                icon: "dollar-sign",
                color: colors.primary,
                bg: colors.accent,
              },
              {
                label: isRTL ? "نقاط أُصدرت" : "Points Issued",
                value: fmtPts(summary?.total_points_issued),
                icon: "star",
                color: "#8B5CF6",
                bg: "#EDE9FE",
              },
              {
                label: isRTL ? "طلبات مؤكدة" : "Confirmed",
                value: fmtNum(summary?.confirmed_count),
                icon: "check-circle",
                color: "#22C55E",
                bg: "#DCFCE7",
              },
              {
                label: isRTL ? "قيد الانتظار" : "Pending",
                value: fmtNum(summary?.pending_count),
                icon: "clock",
                color: "#F59E0B",
                bg: "#FEF3C7",
              },
            ].map((card) => (
              <View
                key={card.label}
                style={[styles.summaryCard, { backgroundColor: card.bg, flex: 1 }]}
              >
                <VectorIcon name={card.icon as never} size={20} color={card.color} />
                <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
                <Text style={[styles.cardLabel, { color: card.color }]}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Points flow ── */}
          <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "حركة النقاط" : "Points Flow"}
          </Text>
          <View style={[styles.flowTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: isRTL ? "نقاط تم شراؤها" : "Points Purchased", value: fmtPts(tx?.pts_purchased), color: "#22C55E" },
              { label: isRTL ? "نقاط مستهلكة (فتح طلبات)" : "Points Spent (Unlocks)", value: fmtPts(tx?.pts_unlocked), color: "#EF4444" },
              { label: isRTL ? "نقاط مستردة (نزاعات)" : "Points Refunded (Disputes)", value: fmtPts(tx?.pts_refunded), color: "#F59E0B" },
              { label: isRTL ? "مكافآت ترحيبية" : "Welcome Bonuses", value: fmtPts(tx?.pts_bonus), color: "#8B5CF6" },
              { label: isRTL ? "تعديلات يدوية" : "Manual Adjustments", value: fmtPts(tx?.pts_adjusted), color: colors.mutedForeground },
            ].map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.flowRow,
                  {
                    flexDirection: isRTL ? "row-reverse" : "row",
                    borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.flowLabel, { color: colors.foreground, flex: 1, textAlign: isRTL ? "right" : "left" }]}>
                  {row.label}
                </Text>
                <Text style={[styles.flowValue, { color: row.color }]}>{row.value}</Text>
              </View>
            ))}
            <View
              style={[
                styles.flowRow,
                {
                  flexDirection: isRTL ? "row-reverse" : "row",
                  borderTopWidth: 2,
                  borderTopColor: colors.border,
                  backgroundColor: colors.muted,
                },
              ]}
            >
              <Text style={[styles.flowLabel, { color: colors.foreground, flex: 1, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "رسوم بوابات الدفع" : "Gateway Fees"}
              </Text>
              <Text style={[styles.flowValue, { color: "#EF4444", fontFamily: "Inter_700Bold" }]}>
                {fmtEgp(tx?.total_gateway_fees)} {isRTL ? "ج.م" : "EGP"}
              </Text>
            </View>
          </View>

          {/* ── Payment method breakdown ── */}
          {(data?.byMethod?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "تفصيل وسائل الدفع" : "By Payment Method"}
              </Text>
              <View style={[styles.flowTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View
                  style={[
                    styles.flowRow,
                    {
                      flexDirection: isRTL ? "row-reverse" : "row",
                      backgroundColor: colors.muted,
                    },
                  ]}
                >
                  {[
                    { key: "method", label: isRTL ? "الوسيلة" : "Method", flex: 1.4 },
                    { key: "requests", label: isRTL ? "الطلبات" : "Requests", flex: 0.9 },
                    { key: "confirmed", label: isRTL ? "مؤكدة" : "Confirmed", flex: 0.9 },
                    { key: "cash", label: isRTL ? "المبلغ" : "Amount (EGP)", flex: 1.2 },
                  ].map((col) => (
                    <Text
                      key={col.key}
                      style={[
                        styles.flowLabel,
                        {
                          color: colors.mutedForeground,
                          flex: col.flex,
                          fontFamily: "Inter_600SemiBold",
                          textAlign: isRTL ? "right" : "left",
                        },
                      ]}
                    >
                      {col.label}
                    </Text>
                  ))}
                </View>
                {data?.byMethod?.map((row, i) => (
                  <View
                    key={row.payment_method}
                    style={[
                      styles.flowRow,
                      {
                        flexDirection: isRTL ? "row-reverse" : "row",
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.flowLabel, { color: colors.foreground, flex: 1.4, textAlign: isRTL ? "right" : "left" }]}>
                      {isRTL
                        ? METHOD_LABELS[row.payment_method]?.ar ?? row.payment_method
                        : METHOD_LABELS[row.payment_method]?.en ?? row.payment_method}
                    </Text>
                    <Text style={[styles.flowValue, { color: colors.mutedForeground, flex: 0.9, textAlign: "center" }]}>
                      {fmtNum(row.total_requests)}
                    </Text>
                    <Text style={[styles.flowValue, { color: "#22C55E", flex: 0.9, textAlign: "center" }]}>
                      {fmtNum(row.confirmed)}
                    </Text>
                    <Text style={[styles.flowValue, { color: colors.primary, flex: 1.2, textAlign: isRTL ? "left" : "right" }]}>
                      {fmtEgp(row.cash_egp)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Daily breakdown ── */}
          {(data?.daily?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "التفصيل اليومي" : "Daily Breakdown"}
              </Text>
              <View style={[styles.flowTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View
                  style={[
                    styles.flowRow,
                    { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: colors.muted },
                  ]}
                >
                  {[
                    { key: "day", label: isRTL ? "اليوم" : "Day", flex: 1.3 },
                    { key: "cnt", label: isRTL ? "مؤكدة" : "Confirmed", flex: 0.9 },
                    { key: "pts", label: isRTL ? "نقاط" : "Points", flex: 0.9 },
                    { key: "cash", label: isRTL ? "المبلغ" : "EGP", flex: 1 },
                  ].map((col) => (
                    <Text
                      key={col.key}
                      style={[
                        styles.flowLabel,
                        {
                          color: colors.mutedForeground,
                          flex: col.flex,
                          fontFamily: "Inter_600SemiBold",
                          textAlign: isRTL ? "right" : "left",
                        },
                      ]}
                    >
                      {col.label}
                    </Text>
                  ))}
                </View>
                {data?.daily?.map((row) => (
                  <View
                    key={row.day}
                    style={[
                      styles.flowRow,
                      {
                        flexDirection: isRTL ? "row-reverse" : "row",
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.flowLabel, { color: colors.foreground, flex: 1.3, textAlign: isRTL ? "right" : "left" }]}>
                      {new Date(row.day).toLocaleDateString(isRTL ? "ar-EG" : "en-GB", {
                        day: "2-digit", month: "short",
                      })}
                    </Text>
                    <Text style={[styles.flowValue, { color: "#22C55E", flex: 0.9, textAlign: "center" }]}>
                      {fmtNum(row.confirmed)}
                    </Text>
                    <Text style={[styles.flowValue, { color: "#8B5CF6", flex: 0.9, textAlign: "center" }]}>
                      {fmtPts(row.points_issued)}
                    </Text>
                    <Text style={[styles.flowValue, { color: colors.primary, flex: 1, textAlign: isRTL ? "left" : "right" }]}>
                      {fmtEgp(row.cash_egp)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterToggle: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderRadius: 8,
  },
  filterToggleText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  periodLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
  filterPanel: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  dateRow: { alignItems: "flex-end", gap: 10 },
  dateField: { flex: 1 },
  dateLabel: { fontFamily: "Inter_500Medium", fontSize: 11, marginBottom: 4 },
  dateInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    fontFamily: "Inter_400Regular", fontSize: 13,
  },
  applyBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, alignSelf: "flex-end" },
  applyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  sectionTitle: {
    fontFamily: "Inter_700Bold", fontSize: 14,
    marginBottom: 10, marginTop: 4,
  },
  cardsGrid: { flexWrap: "wrap", gap: 8, marginBottom: 20 },
  summaryCard: {
    alignItems: "center", padding: 12, borderRadius: 12, gap: 4, minWidth: "47%",
  },
  cardValue: { fontFamily: "Inter_700Bold", fontSize: 15, textAlign: "center" },
  cardLabel: { fontFamily: "Inter_400Regular", fontSize: 10, textAlign: "center", opacity: 0.85 },
  flowTable: { borderWidth: 1, borderRadius: 12, marginBottom: 20, overflow: "hidden" },
  flowRow: { paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" },
  flowLabel: { fontFamily: "Inter_400Regular", fontSize: 13 },
  flowValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right" },
});
