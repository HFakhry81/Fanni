import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import { KeyboardAvoidingSheet } from "@/components/KeyboardAwareScrollViewCompat";
import VectorIcon from "@/components/VectorIcon";
import { getApiBase } from "@/utils/api";

interface SenderDetails {
  accountNumber?: string;
  accountName?: string;
  instapayId?: string;
  walletNumber?: string;
  bankName?: string;
}

interface PaymentRequest {
  id: string;
  amount_egp: string;
  points_requested: number;
  payment_method: "bank_transfer" | "instapay" | "e_wallet";
  reference_number: string | null;
  transfer_note: string | null;
  sender_details: SenderDetails | null;
  status: "pending" | "confirmed" | "rejected";
  admin_notes: string | null;
  confirmed_at: string | null;
  created_at: string;
  user_id: string;
  user_first_name: string | null;
  user_last_name: string | null;
  user_mobile: string;
  package_name_en: string | null;
  package_name_ar: string | null;
}

const METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  bank_transfer: { ar: "تحويل بنكي", en: "Bank Transfer" },
  instapay: { ar: "إنستا باي", en: "InstaPay" },
  e_wallet: { ar: "محفظة إلكترونية", en: "E-Wallet" },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#22C55E",
  rejected: "#EF4444",
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: "قيد الانتظار", en: "Pending" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  rejected: { ar: "مرفوض", en: "Rejected" },
};

export default function AdminPaymentsScreen() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("pending");
  const [actionItem, setActionItem] = useState<PaymentRequest | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    }),
    [sessionToken],
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = filter === "all" ? "" : `&status=${filter}`;
      const res = await fetch(
        `${getApiBase()}/api/admin/payments?${statusParam}`,
        { headers: authHeaders() },
      );
      if (!res.ok) { setRequests([]); return; }
      const data = await res.json() as { requests: PaymentRequest[] };
      setRequests(data.requests ?? []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filter, authHeaders]);

  useFocusEffect(useCallback(() => { fetchRequests(); }, [fetchRequests]));

  const doAction = async () => {
    if (!actionItem || !actionType) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `${getApiBase()}/api/admin/payments/${actionItem.id}/${actionType}`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ adminNotes: adminNotes.trim() || undefined }),
        },
      );
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        Alert.alert(isRTL ? "خطأ" : "Error", data.error ?? `HTTP ${res.status}`);
        return;
      }
      setActionItem(null);
      setActionType(null);
      setAdminNotes("");
      await fetchRequests();
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل الاتصال" : "Connection failed");
    } finally {
      setActionLoading(false);
    }
  };

  const userName = (r: PaymentRequest) =>
    [r.user_first_name, r.user_last_name].filter(Boolean).join(" ") || r.user_mobile;

  const renderItem = ({ item }: { item: PaymentRequest }) => {
    const statusColor = STATUS_COLORS[item.status] ?? colors.mutedForeground;
    const statusLabel = isRTL
      ? STATUS_LABELS[item.status]?.ar
      : STATUS_LABELS[item.status]?.en;
    const methodLabel = isRTL
      ? METHOD_LABELS[item.payment_method]?.ar
      : METHOD_LABELS[item.payment_method]?.en;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderLeftColor: statusColor,
            flexDirection: isRTL ? "row-reverse" : "row",
          },
        ]}
      >
        {/* Status stripe */}
        <View style={[styles.stripe, { backgroundColor: statusColor }]} />

        <View style={{ flex: 1 }}>
          {/* Header row */}
          <View
            style={[
              styles.cardHeader,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Text
              style={[
                styles.userName,
                { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
              ]}
            >
              {userName(item)}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor + "22" },
              ]}
            >
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Amount + Points */}
          <View
            style={[
              styles.amountRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Text style={[styles.amount, { color: colors.primary }]}>
              {parseFloat(item.amount_egp).toFixed(2)} {isRTL ? "ج.م" : "EGP"}
            </Text>
            <Text
              style={[
                styles.points,
                { color: colors.mutedForeground },
              ]}
            >
              → {item.points_requested.toLocaleString()} {isRTL ? "نقطة" : "pts"}
            </Text>
          </View>

          {/* Method + Ref */}
          <View
            style={[
              styles.detailRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Text
              style={[styles.detail, { color: colors.mutedForeground }]}
            >
              {methodLabel}
            </Text>
            {item.reference_number ? (
              <Text
                style={[styles.detail, { color: colors.mutedForeground }]}
              >
                {isRTL ? "مرجع: " : "Ref: "}
                {item.reference_number}
              </Text>
            ) : null}
          </View>

          {/* Sender details (source account) */}
          {item.sender_details && Object.keys(item.sender_details).length > 0 && (
            <View style={[styles.senderBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.senderTitle, { color: colors.foreground }]}>
                {isRTL ? "بيانات حساب المُرسِل" : "Sender Account Details"}
              </Text>
              {item.sender_details.bankName ? (
                <Text style={[styles.senderRow, { color: colors.mutedForeground }]}>
                  🏦 {item.sender_details.bankName}
                </Text>
              ) : null}
              {item.sender_details.accountName ? (
                <Text style={[styles.senderRow, { color: colors.mutedForeground }]}>
                  👤 {item.sender_details.accountName}
                </Text>
              ) : null}
              {item.sender_details.accountNumber ? (
                <Text style={[styles.senderRow, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  #{item.sender_details.accountNumber}
                </Text>
              ) : null}
              {item.sender_details.instapayId ? (
                <Text style={[styles.senderRow, { color: colors.mutedForeground }]}>
                  InstaPay: {item.sender_details.instapayId}
                </Text>
              ) : null}
              {item.sender_details.walletNumber ? (
                <Text style={[styles.senderRow, { color: colors.mutedForeground }]}>
                  📱 {item.sender_details.walletNumber}
                </Text>
              ) : null}
            </View>
          )}

          {/* Mobile */}
          <Text
            style={[
              styles.detail,
              { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {item.user_mobile}
          </Text>

          {/* Notes */}
          {item.transfer_note ? (
            <Text
              style={[
                styles.note,
                { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
              ]}
              numberOfLines={2}
            >
              {item.transfer_note}
            </Text>
          ) : null}

          {/* Admin notes */}
          {item.admin_notes ? (
            <Text
              style={[
                styles.adminNote,
                { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
              ]}
            >
              🔔 {item.admin_notes}
            </Text>
          ) : null}

          {/* Date */}
          <Text
            style={[
              styles.date,
              { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {new Date(item.created_at).toLocaleString(isRTL ? "ar-EG" : "en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>

          {/* Actions */}
          {item.status === "pending" && (
            <View
              style={[
                styles.actions,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#22C55E" }]}
                onPress={() => {
                  setActionItem(item);
                  setActionType("confirm");
                  setAdminNotes("");
                }}
              >
                <VectorIcon name="check" size={14} color="#fff" />
                <Text style={styles.actionBtnText}>
                  {isRTL ? "تأكيد" : "Confirm"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#EF4444" }]}
                onPress={() => {
                  setActionItem(item);
                  setActionType("reject");
                  setAdminNotes("");
                }}
              >
                <VectorIcon name="x" size={14} color="#fff" />
                <Text style={styles.actionBtnText}>
                  {isRTL ? "رفض" : "Reject"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const filterOptions: Array<{ key: typeof filter; ar: string; en: string }> = [
    { key: "pending", ar: "قيد الانتظار", en: "Pending" },
    { key: "confirmed", ar: "مؤكدة", en: "Confirmed" },
    { key: "rejected", ar: "مرفوضة", en: "Rejected" },
    { key: "all", ar: "الكل", en: "All" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "طلبات الدفع" : "Payment Requests"}
        showHome
        showLogout
      />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={[
          styles.filterContent,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        {filterOptions.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.chip,
              {
                backgroundColor:
                  filter === opt.key ? colors.primary : colors.card,
                borderColor:
                  filter === opt.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setFilter(opt.key)}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    filter === opt.key ? "#fff" : colors.mutedForeground,
                },
              ]}
            >
              {isRTL ? opt.ar : opt.en}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <VectorIcon name="inbox" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {isRTL ? "لا توجد طلبات" : "No requests found"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 14, paddingBottom: botPad + 20 }}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchRequests}
          refreshing={loading}
        />
      )}

      {/* Confirm / Reject Modal */}
      <Modal
        visible={!!actionItem}
        transparent
        animationType="fade"
        onRequestClose={() => setActionItem(null)}
      >
        <KeyboardAvoidingSheet contentPosition="center" style={styles.modalOverlay}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
              ]}
            >
              {actionType === "confirm"
                ? isRTL
                  ? "تأكيد الدفع"
                  : "Confirm Payment"
                : isRTL
                  ? "رفض الطلب"
                  : "Reject Request"}
            </Text>

            {actionItem && (
              <View
                style={[
                  styles.modalSummary,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {userName(actionItem)} — {actionItem.user_mobile}
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: "Inter_700Bold",
                    fontSize: 18,
                    textAlign: isRTL ? "right" : "left",
                    marginTop: 4,
                  }}
                >
                  {parseFloat(actionItem.amount_egp).toFixed(2)} ج.م →{" "}
                  {actionItem.points_requested.toLocaleString()}{" "}
                  {isRTL ? "نقطة" : "pts"}
                </Text>
              </View>
            )}

            {actionType === "confirm" && (
              <Text
                style={{
                  color: "#22C55E",
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  marginBottom: 8,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {isRTL
                  ? "سيتم إضافة النقاط فوراً إلى محفظة الفني"
                  : "Points will be credited to technician's wallet immediately"}
              </Text>
            )}

            <TextInput
              style={[
                styles.notesInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  textAlign: isRTL ? "right" : "left",
                },
              ]}
              placeholder={isRTL ? "ملاحظات (اختياري)" : "Notes (optional)"}
              placeholderTextColor={colors.mutedForeground}
              value={adminNotes}
              onChangeText={setAdminNotes}
              multiline
              numberOfLines={2}
            />

            <View
              style={[
                styles.modalActions,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { borderColor: colors.border, backgroundColor: colors.background },
                ]}
                onPress={() => { setActionItem(null); setActionType(null); }}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  {isRTL ? "إلغاء" : "Cancel"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor:
                      actionType === "confirm" ? "#22C55E" : "#EF4444",
                    borderColor:
                      actionType === "confirm" ? "#22C55E" : "#EF4444",
                  },
                ]}
                onPress={doAction}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}
                  >
                    {actionType === "confirm"
                      ? isRTL ? "تأكيد وإضافة النقاط" : "Confirm & Credit"
                      : isRTL ? "رفض الطلب" : "Reject"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingSheet>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: { borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
    paddingRight: 14,
    paddingVertical: 12,
    gap: 0,
  },
  stripe: { width: 4, marginRight: 10 },
  cardHeader: { alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  userName: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  statusText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  amountRow: { alignItems: "center", gap: 8, marginBottom: 4 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 16 },
  points: { fontFamily: "Inter_500Medium", fontSize: 13 },
  detailRow: { gap: 12, marginBottom: 2 },
  detail: { fontFamily: "Inter_400Regular", fontSize: 12 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4, opacity: 0.85 },
  adminNote: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3, fontStyle: "italic" },
  date: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 4, opacity: 0.6 },
  actions: { marginTop: 10, gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  modalSummary: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    minHeight: 56,
  },
  modalActions: { gap: 10 },
  senderBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    gap: 2,
  },
  senderTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 4 },
  senderRow: { fontFamily: "Inter_400Regular", fontSize: 12 },
  modalBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
});
