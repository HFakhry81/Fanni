import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator, Modal, TextInput, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
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
  clientName: string | null;
  clientMobile: string | null;
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

export default function TechInvoicesScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken, isAuthenticated } = useAuth();
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ orderId: "", subtotal: "", taxRate: "14", noteAr: "", noteEn: "" });
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!isAuthenticated || !sessionToken) return;
    const base = getApiBaseUrl();
    if (!base) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/invoices`, { headers: { Authorization: `Bearer ${sessionToken}` } });
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

  const markPaid = async (id: string) => {
    const base = getApiBaseUrl();
    if (!base || !sessionToken) return;
    try {
      await fetch(`${base}/api/invoices/${id}/pay`, { method: "PATCH", headers: { Authorization: `Bearer ${sessionToken}` } });
      fetchInvoices();
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    const sub = parseFloat(form.subtotal);
    if (!sub || sub <= 0) {
      setCreateError(isRTL ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
      return;
    }
    const base = getApiBaseUrl();
    if (!base || !sessionToken) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const res = await fetch(`${base}/api/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          orderId: form.orderId || undefined,
          subtotal: sub,
          taxRate: parseFloat(form.taxRate) || 14,
          noteAr: form.noteAr || undefined,
          noteEn: form.noteEn || undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ orderId: "", subtotal: "", taxRate: "14", noteAr: "", noteEn: "" });
        fetchInvoices();
      } else {
        const d = await res.json();
        setCreateError(d.error ?? (isRTL ? "فشل إنشاء الفاتورة" : "Failed to create invoice"));
      }
    } catch {
      setCreateError(isRTL ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  const totalEarned = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter(i => i.status === "issued").reduce((s, i) => s + i.total, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={isRTL ? "فواتيري" : "My Invoices"} />

      <View style={[styles.summaryBanner, { backgroundColor: colors.darkMid }]}>
        <View style={[styles.summaryRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "إجمالي المحصّل" : "Total Collected"}
            </Text>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 24, textAlign: isRTL ? "right" : "left" }}>
              {totalEarned.toFixed(0)} <Text style={{ fontSize: 13 }}>{t("common.egp")}</Text>
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "في انتظار الدفع" : "Pending Payment"}
            </Text>
            <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold", fontSize: 24, textAlign: isRTL ? "right" : "left" }}>
              {totalPending.toFixed(0)} <Text style={{ fontSize: 13 }}>{t("common.egp")}</Text>
            </Text>
          </View>
        </View>
        <View style={[styles.summaryFooter, { flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between" }]}>
          <View style={[styles.statChip, { backgroundColor: "rgba(77,173,217,0.15)" }]}>
            <Feather name="file-text" size={13} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
              {invoices.length} {isRTL ? "فاتورة" : "invoices"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreate(true)}
          >
            <Feather name="plus" size={15} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 5 }}>
              {isRTL ? "فاتورة جديدة" : "New Invoice"}
            </Text>
          </TouchableOpacity>
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
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 40 }]}>
                <Feather name="file-text" size={40} color={colors.mutedForeground} />
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 14, textAlign: "center", fontFamily: "Inter_400Regular" }}>
                {isRTL ? "لا توجد فواتير بعد" : "No invoices yet"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <View style={[styles.accentBar, { backgroundColor: statusColor(item.status, colors) }]} />
              <View style={styles.cardBody}>
                <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.accent, borderRadius: 12 }]}>
                    <Feather name="file-text" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                      {item.invoiceNumber}
                    </Text>
                    {item.clientName && (
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1, textAlign: isRTL ? "right" : "left" }}>
                        <Feather name="user" size={11} /> {item.clientName}
                        {item.clientMobile ? ` · ${item.clientMobile}` : ""}
                      </Text>
                    )}
                    {item.orderNumber && (
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1, textAlign: isRTL ? "right" : "left" }}>
                        {item.orderNumber}{item.category ? ` · ${t(`cat.${item.category}`)}` : ""}
                      </Text>
                    )}
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
                      {isRTL
                        ? `صافي: ${item.subtotal.toFixed(0)} ج.م · ضريبة ${item.taxRate}%: ${item.taxAmount.toFixed(0)} ج.م`
                        : `Net: ${item.subtotal.toFixed(0)} EGP · VAT ${item.taxRate}%: ${item.taxAmount.toFixed(0)} EGP`}
                    </Text>
                  </View>
                )}
                {item.status === "issued" && (
                  <TouchableOpacity
                    style={[styles.payBtn, { backgroundColor: (colors.success ?? "#22A36B") + "20", borderColor: colors.success ?? "#22A36B" }]}
                    onPress={() => markPaid(item.id)}
                  >
                    <Feather name="check-circle" size={14} color={colors.success ?? "#22A36B"} />
                    <Text style={{ color: colors.success ?? "#22A36B", fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
                      {isRTL ? "تأكيد الاستلام" : "Mark as Paid"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, flex: 1, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "إنشاء فاتورة" : "Create Invoice"}
              </Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "رقم الطلب (اختياري)" : "Order ID (optional)"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                placeholder={isRTL ? "مثال: ORD-000001" : "e.g. order UUID or ORD number"}
                placeholderTextColor={colors.mutedForeground}
                value={form.orderId}
                onChangeText={v => setForm(f => ({ ...f, orderId: v }))}
              />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "المبلغ قبل الضريبة (ج.م) *" : "Amount before tax (EGP) *"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={form.subtotal}
                onChangeText={v => setForm(f => ({ ...f, subtotal: v }))}
              />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "نسبة الضريبة %" : "Tax rate %"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                placeholder="14"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={form.taxRate}
                onChangeText={v => setForm(f => ({ ...f, taxRate: v }))}
              />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "ملاحظات (عربي)" : "Notes (Arabic)"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: "right", minHeight: 60 }]}
                placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
                placeholderTextColor={colors.mutedForeground}
                multiline
                value={form.noteAr}
                onChangeText={v => setForm(f => ({ ...f, noteAr: v }))}
              />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "ملاحظات (إنجليزي)" : "Notes (English)"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: "left", minHeight: 60 }]}
                placeholder="Additional notes..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                value={form.noteEn}
                onChangeText={v => setForm(f => ({ ...f, noteEn: v }))}
              />
              {createError && (
                <Text style={{ color: colors.destructive ?? "#EF4444", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" }}>
                  {createError}
                </Text>
              )}
              {form.subtotal ? (
                <View style={[styles.calcPreview, { backgroundColor: colors.muted, borderRadius: 10 }]}>
                  {(() => {
                    const sub = parseFloat(form.subtotal) || 0;
                    const tax = parseFloat(form.taxRate) || 14;
                    const taxAmt = (sub * tax) / 100;
                    const total = sub + taxAmt;
                    return (
                      <>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                          {isRTL ? `صافي: ${sub.toFixed(2)} ج.م  +  ضريبة ${tax}%: ${taxAmt.toFixed(2)} ج.م` : `Net: ${sub.toFixed(2)} EGP  +  VAT ${tax}%: ${taxAmt.toFixed(2)} EGP`}
                        </Text>
                        <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: isRTL ? "right" : "left", marginTop: 4 }}>
                          {isRTL ? `الإجمالي: ${total.toFixed(2)} ج.م` : `Total: ${total.toFixed(2)} EGP`}
                        </Text>
                      </>
                    );
                  })()}
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: submitting ? colors.mutedForeground : colors.primary }]}
                onPress={handleCreate}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {isRTL ? "إصدار الفاتورة" : "Issue Invoice"}
                    </Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryBanner: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 16, padding: 18 },
  summaryRow: { alignItems: "flex-start", marginBottom: 12, gap: 12 },
  summaryFooter: { alignItems: "center" },
  statChip: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
  createBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  card: { marginBottom: 12, borderWidth: 1.5, flexDirection: "row", overflow: "hidden", shadowColor: "#0D1B2A", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { alignItems: "center", gap: 0 },
  iconWrap: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  totalChip: { paddingVertical: 8, paddingHorizontal: 12, alignItems: "center" },
  taxRow: { marginTop: 8, borderTopWidth: 1, paddingTop: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  payBtn: { marginTop: 10, flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { maxHeight: "90%", shadowColor: "#000", shadowOpacity: 0.25, shadowOffset: { width: 0, height: -4 }, elevation: 16 },
  modalHeader: { alignItems: "center", padding: 16, borderBottomWidth: 1 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  calcPreview: { padding: 14 },
  submitBtn: { borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 },
});
