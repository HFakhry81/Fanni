import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  invoiceSerial: number;
  orderId: string | null;
  orderNumber: string | null;
  clientId: string | null;
  technicianId: string | null;
  category: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: "draft" | "issued" | "paid" | "cancelled";
  noteAr: string | null;
  noteEn: string | null;
  issuedAt: string;
  paidAt: string | null;
  createdAt: string;
}

function getApiBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

function statusColor(status: string, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case "paid": return colors.success ?? "#22A36B";
    case "issued": return colors.secondary;
    case "cancelled": return colors.destructive ?? "#EF4444";
    default: return colors.mutedForeground;
  }
}

function statusLabel(status: string, isRTL: boolean) {
  const map: Record<string, [string, string]> = {
    issued:    ["مُصدرة",    "Issued"],
    paid:      ["مدفوعة",   "Paid"],
    cancelled: ["ملغاة",    "Cancelled"],
    draft:     ["مسودة",    "Draft"],
  };
  const pair = map[status] ?? [status, status];
  return isRTL ? pair[0] : pair[1];
}

export default function ClientInvoicesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken, isAuthenticated } = useAuth();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!isAuthenticated || !sessionToken) return;
    const base = getApiBaseUrl();
    if (!base) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/invoices`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices ?? []);
      } else {
        setError(isRTL ? "فشل تحميل الفواتير" : "Failed to load invoices");
      }
    } catch {
      setError(isRTL ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, sessionToken, isRTL]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalIssued = invoices.filter(i => i.status === "issued").reduce((s, i) => s + i.total, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("nav.invoices")} />

      <View style={[styles.summaryBanner, { backgroundColor: colors.darkMid }]}>
        <View style={[styles.summaryInner, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "إجمالي المدفوع" : "Total Paid"}
            </Text>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 26, textAlign: isRTL ? "right" : "left" }}>
              {totalPaid.toFixed(0)} <Text style={{ fontSize: 14 }}>{t("common.egp")}</Text>
            </Text>
          </View>
          <View style={[styles.summaryIcon, { backgroundColor: "rgba(245,166,35,0.1)" }]}>
            <Image source={require("@/assets/images/icon.png")} style={{ width: 40, height: 40, borderRadius: 8 }} resizeMode="contain" />
          </View>
        </View>
        <View style={[styles.summaryFooter, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.statChip, { backgroundColor: "rgba(77,173,217,0.15)" }]}>
            <VectorIcon name="check-circle" size={13} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
              {invoices.filter(i => i.status === "paid").length} {isRTL ? "مدفوعة" : "paid"}
            </Text>
          </View>
          {totalIssued > 0 && (
            <View style={[styles.statChip, { backgroundColor: "rgba(245,166,35,0.15)" }]}>
              <VectorIcon name="clock" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
                {totalIssued.toFixed(0)} {t("common.egp")} {isRTL ? "معلقة" : "pending"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive ?? "#EF4444", textAlign: "center", fontFamily: "Inter_400Regular" }}>{error}</Text>
          <TouchableOpacity onPress={fetchInvoices} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold" }}>{isRTL ? "إعادة المحاولة" : "Retry"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
          ListEmptyComponent={
            isAuthenticated ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.accent, borderRadius: 40 }]}>
                  <VectorIcon name="file-text" size={40} color={colors.primary} />
                </View>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 16, textAlign: "center" }}>
                  {t("invoice.noInvoicesYet")}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 6, textAlign: "center", paddingHorizontal: 32 }}>
                  {t("invoice.noInvoicesHint")}
                </Text>
                <TouchableOpacity
                  style={[styles.bookBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
                  onPress={() => router.push("/(client)/home")}
                  activeOpacity={0.85}
                >
                  <VectorIcon name="plus-circle" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                    {t("order.bookService")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 40 }]}>
                  <VectorIcon name="file-text" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 14, textAlign: "center", fontFamily: "Inter_400Regular" }}>
                  {t("common.noData")}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
              onPress={() => item.orderId && router.push({ pathname: "/order-details", params: { orderId: item.orderId } })}
              activeOpacity={0.85}
            >
              <View style={[styles.accentBar, { backgroundColor: statusColor(item.status, colors) }]} />
              <View style={styles.cardBody}>
                <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.accent, borderRadius: 12 }]}>
                    <VectorIcon name="file-text" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                      {item.invoiceNumber}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                      {item.orderNumber ?? ""}{item.category ? ` · ${t(`cat.${item.category}`)}` : ""}
                    </Text>
                    <View style={{ flexDirection: isRTL ? "row-reverse" : "row", marginTop: 4 }}>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColor(item.status, colors)}20` }]}>
                        <Text style={{ color: statusColor(item.status, colors), fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                          {statusLabel(item.status, isRTL)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.totalChip, { backgroundColor: colors.accent, borderRadius: 10 }]}>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{item.total.toFixed(0)}</Text>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 }}>{t("common.egp")}</Text>
                  </View>
                </View>
                {item.taxRate > 0 && (
                  <View style={[styles.taxRow, { borderTopColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                      {isRTL ? `قبل الضريبة: ${item.subtotal.toFixed(0)} ${t("common.egp")} · ضريبة ${item.taxRate}%: ${item.taxAmount.toFixed(0)} ${t("common.egp")}` : `Before tax: ${item.subtotal.toFixed(0)} ${t("common.egp")} · VAT ${item.taxRate}%: ${item.taxAmount.toFixed(0)} ${t("common.egp")}`}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryBanner: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 16, padding: 18 },
  summaryInner: { alignItems: "center", marginBottom: 12 },
  summaryIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  summaryFooter: { gap: 8 },
  statChip: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  card: { marginBottom: 12, borderWidth: 1.5, flexDirection: "row", overflow: "hidden", shadowColor: "#0D1B2A", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { alignItems: "center", gap: 0 },
  iconWrap: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  totalChip: { paddingVertical: 8, paddingHorizontal: 12, alignItems: "center" },
  taxRow: { marginTop: 8, borderTopWidth: 1, paddingTop: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  bookBtn: { alignItems: "center", paddingHorizontal: 28, paddingVertical: 14, marginTop: 24 },
});
