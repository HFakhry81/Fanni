import React, { useState, useCallback, useEffect } from "react";
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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import VectorIcon from "@/components/VectorIcon";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `http://${domain}` : "";
}

interface LedgerEntry {
  id: string;
  orderNumber: string | null;
  technicianName: string | null;
  technicianId: string | null;
  clientName: string | null;
  clientId: string | null;
  labourFee: number | null;
  serviceFeeAmount: number | null;
  vatAmount: number | null;
  netTotal: number | null;
  status: string;
  createdAt: string;
}

const fmt = (n: number | null) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export default function AdminLedgerScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  const defaultFrom = monthAgoStr();
  const defaultTo = todayStr();

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [appliedFrom, setAppliedFrom] = useState(defaultFrom);
  const [appliedTo, setAppliedTo] = useState(defaultTo);
  const [showFilter, setShowFilter] = useState(false);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    }),
    [sessionToken],
  );

  const fetchLedger = useCallback(
    async (filterFrom: string, filterTo: string) => {
      setLoading(true);
      setError(null);
      setNoAccess(false);
      try {
        const url = `${getApiBase()}/api/invoices?invoiceType=admin&from=${filterFrom}&to=${filterTo}`;
        const res = await fetch(url, { headers: authHeaders() });
        if (res.status === 403) {
          setNoAccess(true);
          return;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as { invoices: LedgerEntry[] };
        setEntries(data.invoices ?? []);
      } catch {
        setError(isRTL ? "تعذّر تحميل البيانات" : "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    [authHeaders, isRTL],
  );

  useEffect(() => {
    fetchLedger(appliedFrom, appliedTo);
  }, [fetchLedger, appliedFrom, appliedTo]);

  const totalServiceFees = entries.reduce((s, e) => s + (e.serviceFeeAmount ?? 0), 0);
  const totalVat = entries.reduce((s, e) => s + (e.vatAmount ?? 0), 0);
  const totalNet = entries.reduce((s, e) => s + (e.netTotal ?? 0), 0);

  const exportCsv = async () => {
    const headers = [
      "Order",
      "Technician",
      "Client",
      "Labour Fee (EGP)",
      "Service Fee (EGP)",
      "VAT (EGP)",
      "Net Total (EGP)",
      "Status",
      "Date",
    ];
    const rows = entries.map((e) => [
      e.orderNumber ?? "",
      e.technicianName ?? e.technicianId ?? "",
      e.clientName ?? e.clientId ?? "",
      e.labourFee != null ? e.labourFee.toFixed(2) : "",
      e.serviceFeeAmount != null ? e.serviceFeeAmount.toFixed(2) : "",
      e.vatAmount != null ? e.vatAmount.toFixed(2) : "",
      e.netTotal != null ? e.netTotal.toFixed(2) : "",
      e.status,
      new Date(e.createdAt).toLocaleDateString("en-GB"),
    ]);
    rows.push([
      "TOTAL",
      "",
      "",
      "",
      totalServiceFees.toFixed(2),
      totalVat.toFixed(2),
      totalNet.toFixed(2),
      "",
      "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");

    try {
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ledger_${from}_${to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const path = `${FileSystem.cacheDirectory}ledger_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare)
        await Sharing.shareAsync(path, {
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
        });
    } catch {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل التصدير" : "Export failed",
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={isRTL ? "دفتر الأستاذ" : "Commission Ledger"} showHome showLogout />

      {/* Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.filterToggle, { borderColor: colors.border }]}
          onPress={() => setShowFilter((v) => !v)}
        >
          <VectorIcon name="settings" size={14} color={colors.primary} />
          <Text style={[styles.filterToggleText, { color: colors.primary }]}>
            {isRTL ? "تصفية" : "Filter"}
          </Text>
          <VectorIcon
            name={showFilter ? "chevron-up" : "chevron-down"}
            size={13}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: colors.primary }]}
          onPress={exportCsv}
          disabled={entries.length === 0}
        >
          <VectorIcon name="download" size={14} color="#FFF" />
          <Text style={styles.exportBtnText}>{isRTL ? "تصدير CSV" : "Export CSV"}</Text>
        </TouchableOpacity>
      </View>

      {showFilter && (
        <View
          style={[
            styles.filterPanel,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <View style={[styles.dateRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={styles.dateField}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
                {isRTL ? "من" : "From"}
              </Text>
              <TextInput
                style={[
                  styles.dateInput,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                ]}
                value={from}
                onChangeText={setFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
                {isRTL ? "إلى" : "To"}
              </Text>
              <TextInput
                style={[
                  styles.dateInput,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                ]}
                value={to}
                onChangeText={setTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.secondary }]}
              onPress={() => { setAppliedFrom(from); setAppliedTo(to); }}
            >
              <Text style={styles.applyBtnText}>{isRTL ? "تطبيق" : "Apply"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Summary cards */}
      {!loading && !error && !noAccess && entries.length > 0 && (
        <View
          style={[
            styles.summaryRow,
            { flexDirection: isRTL ? "row-reverse" : "row", backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          {[
            { label: isRTL ? "إجمالي رسوم الخدمة" : "Total Service Fees", value: totalServiceFees, color: colors.primary, bg: colors.accent },
            { label: isRTL ? "إجمالي الضريبة" : "Total VAT", value: totalVat, color: "#E67E22", bg: "#FEF3C7" },
            { label: isRTL ? "صافي الإيراد" : "Net Revenue", value: totalNet, color: colors.success, bg: "#D4EDDA" },
          ].map((card) => (
            <View key={card.label} style={[styles.summaryCard, { backgroundColor: card.bg, borderRadius: colors.radius }]}>
              <Text style={{ color: card.color, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {fmt(card.value)}
              </Text>
              <Text style={{ color: card.color, fontFamily: "Inter_400Regular", fontSize: 10, textAlign: "center", marginTop: 2, opacity: 0.8 }}>
                {card.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : noAccess ? (
        <View style={styles.center}>
          <VectorIcon name="lock" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {isRTL ? "لا توجد صلاحية للوصول" : "Access denied"}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <VectorIcon name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.emptyText, { color: colors.destructive }]}>{error}</Text>
          <TouchableOpacity onPress={() => fetchLedger(appliedFrom, appliedTo)} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
              {isRTL ? "إعادة المحاولة" : "Retry"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <VectorIcon name="inbox" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {isRTL ? "لا توجد سجلات في هذه الفترة" : "No records in this period"}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: botPad + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Table header */}
          <View
            style={[
              styles.tableHeader,
              { backgroundColor: colors.muted, flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            {[
              { key: "order", en: "Order", ar: "الطلب", flex: 1.1 },
              { key: "tech", en: "Technician", ar: "الفني", flex: 1.4 },
              { key: "client", en: "Client", ar: "العميل", flex: 1.3 },
              { key: "labour", en: "Labour", ar: "العمالة", flex: 1 },
              { key: "fee", en: "Svc Fee", ar: "رسوم", flex: 1 },
              { key: "vat", en: "VAT", ar: "ضريبة", flex: 0.85 },
              { key: "date", en: "Date", ar: "التاريخ", flex: 1 },
            ].map((col) => (
              <Text
                key={col.key}
                style={[
                  styles.headerCell,
                  { color: colors.mutedForeground, flex: col.flex, textAlign: isRTL ? "right" : "left" },
                ]}
                numberOfLines={1}
              >
                {isRTL ? col.ar : col.en}
              </Text>
            ))}
          </View>

          {entries.map((entry, idx) => (
            <View
              key={entry.id}
              style={[
                styles.tableRow,
                {
                  backgroundColor: idx % 2 === 0 ? colors.background : colors.card,
                  borderBottomColor: colors.border,
                  flexDirection: isRTL ? "row-reverse" : "row",
                },
              ]}
            >
              <Text
                style={[styles.cell, { color: colors.primary, flex: 1.1, textAlign: isRTL ? "right" : "left" }]}
                numberOfLines={1}
              >
                {entry.orderNumber ?? "—"}
              </Text>
              <Text
                style={[styles.cell, { color: colors.foreground, flex: 1.4, textAlign: isRTL ? "right" : "left" }]}
                numberOfLines={1}
              >
                {entry.technicianName ?? "—"}
              </Text>
              <Text
                style={[styles.cell, { color: colors.foreground, flex: 1.3, textAlign: isRTL ? "right" : "left" }]}
                numberOfLines={1}
              >
                {entry.clientName ?? "—"}
              </Text>
              <Text
                style={[styles.cell, { color: colors.foreground, flex: 1, textAlign: isRTL ? "right" : "left" }]}
                numberOfLines={1}
              >
                {fmt(entry.labourFee)}
              </Text>
              <Text
                style={[styles.cell, { color: colors.primary, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: isRTL ? "right" : "left" }]}
                numberOfLines={1}
              >
                {fmt(entry.serviceFeeAmount)}
              </Text>
              <Text
                style={[styles.cell, { color: "#E67E22", flex: 0.85, textAlign: isRTL ? "right" : "left" }]}
                numberOfLines={1}
              >
                {fmt(entry.vatAmount)}
              </Text>
              <Text
                style={[styles.cell, { color: colors.mutedForeground, flex: 1, textAlign: isRTL ? "right" : "left" }]}
                numberOfLines={1}
              >
                {new Date(entry.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                })}
              </Text>
            </View>
          ))}

          {/* Totals footer */}
          <View
            style={[
              styles.totalsRow,
              { backgroundColor: colors.card, borderTopColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Text
              style={[styles.totalLabel, { color: colors.foreground, flex: 3.8, textAlign: isRTL ? "right" : "left" }]}
            >
              {isRTL ? `الإجمالي (${entries.length} سجل)` : `Total (${entries.length} records)`}
            </Text>
            <Text style={[styles.totalValue, { color: colors.foreground, flex: 1, textAlign: isRTL ? "right" : "left" }]}>
              {""}
            </Text>
            <Text style={[styles.totalValue, { color: colors.primary, flex: 1, textAlign: isRTL ? "right" : "left" }]}>
              {fmt(totalServiceFees)}
            </Text>
            <Text style={[styles.totalValue, { color: "#E67E22", flex: 0.85, textAlign: isRTL ? "right" : "left" }]}>
              {fmt(totalVat)}
            </Text>
            <Text style={[styles.totalValue, { color: colors.mutedForeground, flex: 1, textAlign: isRTL ? "right" : "left" }]}>
              {""}
            </Text>
          </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 8,
  },
  filterToggleText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  exportBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  filterPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dateRow: {
    alignItems: "flex-end",
    gap: 10,
  },
  dateField: { flex: 1 },
  dateLabel: { fontFamily: "Inter_500Medium", fontSize: 11, marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  applyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    alignSelf: "flex-end",
  },
  applyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  tableHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerCell: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    paddingHorizontal: 2,
  },
  tableRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    paddingHorizontal: 2,
  },
  totalsRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 2,
  },
  totalLabel: { fontFamily: "Inter_700Bold", fontSize: 12, paddingHorizontal: 2 },
  totalValue: { fontFamily: "Inter_700Bold", fontSize: 12, paddingHorizontal: 2 },
});
