import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import AppHeader from "@/components/AppHeader";
import FanniButton from "@/components/FanniButton";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/utils/api";

interface AdminDispute {
  id: string;
  lead_unlock_id: string;
  technician_id: string;
  order_id: string;
  reason: string;
  status: "submitted" | "under_review" | "approved" | "rejected";
  admin_notes: string | null;
  points_refunded: boolean;
  resolved_at: string | null;
  created_at: string;
  tech_first_name: string | null;
  tech_last_name: string | null;
  tech_mobile: string | null;
  points_deducted: number;
  clicked_call: boolean;
  clicked_whatsapp: boolean;
  unlocked_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "#F59E0B",
  under_review: "#3B82F6",
  approved: "#22C55E",
  rejected: "#EF4444",
};

const STATUS_LABELS_AR: Record<string, string> = {
  submitted: "مُقدَّم",
  under_review: "قيد المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
};

const STATUS_LABELS_EN: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

export default function AdminDisputesScreen() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const [resolveModal, setResolveModal] = useState<{ visible: boolean; dispute: AdminDispute | null }>({ visible: false, dispute: null });
  const [adminNotes, setAdminNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  const fetchDisputes = useCallback(async (isRefresh = false) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/disputes`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const json = await res.json() as { disputes: AdminDispute[] };
        setDisputes(json.disputes ?? []);
      }
    } catch (err) {
      console.warn("[AdminDisputes] fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  useFocusEffect(useCallback(() => { fetchDisputes(); }, [fetchDisputes]));

  const handleResolve = async (action: "approve" | "reject") => {
    const dispute = resolveModal.dispute;
    if (!dispute) return;
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    setResolving(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/disputes/${dispute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action, adminNotes: adminNotes.trim() || null }),
      });
      if (res.ok) {
        setResolveModal({ visible: false, dispute: null });
        setAdminNotes("");
        await fetchDisputes(true);
      }
    } catch (err) {
      console.warn("[AdminDisputes] resolve error:", err);
    } finally {
      setResolving(false);
    }
  };

  const filters = ["all", "submitted", "under_review", "approved", "rejected"];
  const filtered = filter === "all" ? disputes : disputes.filter((d) => d.status === filter);

  const statusLabel = (status: string) =>
    isRTL ? (STATUS_LABELS_AR[status] ?? status) : (STATUS_LABELS_EN[status] ?? status);
  const statusColor = (status: string) => STATUS_COLORS[status] ?? colors.mutedForeground;

  const techName = (d: AdminDispute) =>
    [d.tech_first_name, d.tech_last_name].filter(Boolean).join(" ") || d.tech_mobile || d.technician_id.slice(0, 8);

  const renderItem = ({ item }: { item: AdminDispute }) => {
    const canResolve = item.status === "submitted" || item.status === "under_review";
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: statusColor(item.status) + "60",
            borderRadius: colors.radius,
          },
        ]}
      >
        {/* Status stripe */}
        <View style={[styles.stripe, { backgroundColor: statusColor(item.status) }]} />
        <View style={styles.cardBody}>
          {/* Header row */}
          <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row", marginBottom: 6 }]}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + "20" }]}>
              <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
            {item.points_refunded && (
              <View style={[styles.statusBadge, { backgroundColor: "#dcfce7", marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }]}>
                <Text style={[styles.statusText, { color: "#16a34a" }]}>
                  {isRTL ? "نقاط مُستردّة" : "Points Refunded"}
                </Text>
              </View>
            )}
            <Text style={[styles.dateText, { color: colors.mutedForeground, marginLeft: isRTL ? 0 : "auto", marginRight: isRTL ? "auto" : 0 }]}>
              {new Date(item.created_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { day: "numeric", month: "short" })}
            </Text>
          </View>

          {/* Technician */}
          <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row", marginBottom: 4 }]}>
            <VectorIcon name="user" size={13} color={colors.mutedForeground} />
            <Text style={[styles.techText, { color: colors.foreground, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }]}>
              {techName(item)}
            </Text>
            {item.tech_mobile ? (
              <Text style={[styles.mobileText, { color: colors.mutedForeground }]}>
                {item.tech_mobile}
              </Text>
            ) : null}
          </View>

          {/* Order + cost */}
          <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row", marginBottom: 6 }]}>
            <VectorIcon name="file-text" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }]}>
              {isRTL ? "طلب:" : "Order:"} {item.order_id.slice(0, 12)}…
            </Text>
            <Text style={[styles.metaText, { color: "#F59E0B", marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}>
              {item.points_deducted} {isRTL ? "نقطة" : "pts"}
            </Text>
          </View>

          {/* Contact tracking */}
          <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row", marginBottom: 8, gap: 8 }]}>
            <View style={[styles.trackChip, { backgroundColor: item.clicked_call ? "#dcfce7" : colors.muted + "40" }]}>
              <VectorIcon name="phone" size={11} color={item.clicked_call ? "#16a34a" : colors.mutedForeground} />
              <Text style={{ color: item.clicked_call ? "#16a34a" : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10, marginLeft: 3 }}>
                {isRTL ? "اتصل" : "Called"}
              </Text>
            </View>
            <View style={[styles.trackChip, { backgroundColor: item.clicked_whatsapp ? "#dcfce7" : colors.muted + "40" }]}>
              <Text style={{ color: item.clicked_whatsapp ? "#16a34a" : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                {isRTL ? "واتساب" : "WhatsApp"}
              </Text>
            </View>
          </View>

          {/* Reason */}
          <View style={[styles.reasonBox, { backgroundColor: colors.muted + "30", borderRadius: colors.radius - 4 }]}>
            <Text style={[styles.reasonLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
              {isRTL ? "السبب:" : "Reason:"}
            </Text>
            <Text style={[styles.reasonText, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
              {item.reason}
            </Text>
          </View>

          {/* Admin notes if resolved */}
          {item.admin_notes ? (
            <View style={[styles.notesBox, { backgroundColor: "#eff6ff", borderRadius: colors.radius - 4 }]}>
              <Text style={[styles.reasonLabel, { color: "#1e40af", textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "ملاحظات المشرف:" : "Admin notes:"}
              </Text>
              <Text style={[styles.reasonText, { color: "#1e3a8a", textAlign: isRTL ? "right" : "left" }]}>
                {item.admin_notes}
              </Text>
            </View>
          ) : null}

          {/* Resolve button */}
          {canResolve && (
            <TouchableOpacity
              style={[styles.resolveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius - 4 }]}
              onPress={() => { setResolveModal({ visible: true, dispute: item }); setAdminNotes(""); }}
            >
              <VectorIcon name="check-circle" size={14} color="#fff" />
              <Text style={styles.resolveBtnText}>
                {isRTL ? "مراجعة وبتّ" : "Review & Resolve"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "نزاعات الفنيين" : "Technician Disputes"}
        subtitle={
          filtered.length > 0
            ? isRTL ? `${filtered.length} نزاع` : `${filtered.length} dispute${filtered.length !== 1 ? "s" : ""}`
            : undefined
        }
        showHome
        showLogout
      />

      {/* Filter chips */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((f) => {
            const active = filter === f;
            const label = f === "all" ? (isRTL ? "الكل" : "All") : statusLabel(f);
            const chipColor = f === "all" ? colors.primary : statusColor(f);
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? chipColor : colors.card,
                    borderColor: chipColor,
                    borderRadius: 20,
                  },
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.chipText, { color: active ? "#fff" : chipColor }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchDisputes(true)} tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <VectorIcon name="check-circle" size={48} color={colors.mutedForeground + "60"} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isRTL ? "لا توجد نزاعات" : "No disputes"}
              </Text>
            </View>
          }
        />
      )}

      {/* Resolve modal */}
      <Modal visible={resolveModal.visible} transparent animationType="slide" onRequestClose={() => setResolveModal({ visible: false, dispute: null })}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderRadius: 20 }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
              {isRTL ? "البتّ في النزاع" : "Resolve Dispute"}
            </Text>

            {resolveModal.dispute && (
              <>
                <View style={[styles.disputeSummary, { backgroundColor: colors.muted + "30", borderRadius: colors.radius - 4 }]}>
                  <Text style={[styles.summaryText, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "الفني: " : "Tech: "}{techName(resolveModal.dispute)}
                  </Text>
                  <Text style={[styles.summaryText, { color: "#F59E0B", textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "النقاط: " : "Points: "}{resolveModal.dispute.points_deducted} {isRTL ? "نقطة" : "pts"}
                  </Text>
                  <Text style={[styles.summaryReason, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                    {resolveModal.dispute.reason}
                  </Text>
                </View>

                <Text style={[styles.notesLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                  {isRTL ? "ملاحظات (اختياري)" : "Notes (optional)"}
                </Text>
                <TextInput
                  style={[
                    styles.notesInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                      borderRadius: colors.radius - 4,
                      textAlign: isRTL ? "right" : "left",
                    },
                  ]}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  placeholder={isRTL ? "سبب القرار…" : "Reason for decision…"}
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                />

                <View style={[styles.actionRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <FanniButton
                    title={isRTL ? `✅ موافقة + استرداد ${resolveModal.dispute.points_deducted} نقطة` : `✅ Approve + Refund ${resolveModal.dispute.points_deducted} pts`}
                    onPress={() => handleResolve("approve")}
                    loading={resolving}
                    style={{ flex: 1 }}
                  />
                  <TouchableOpacity
                    style={[styles.rejectBtn, { borderColor: "#ef4444", borderRadius: colors.radius - 4 }]}
                    onPress={() => handleResolve("reject")}
                    disabled={resolving}
                  >
                    <Text style={{ color: "#ef4444", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      {isRTL ? "رفض" : "Reject"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setResolveModal({ visible: false, dispute: null })} style={{ alignItems: "center", paddingTop: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                    {isRTL ? "إلغاء" : "Cancel"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  filterWrapper: { paddingVertical: 10 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1.5 },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  list: { padding: 16, paddingBottom: Platform.OS === "web" ? 100 : 90, gap: 12 },
  card: { flexDirection: "row", borderWidth: 1.5, overflow: "hidden" },
  stripe: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  row: { alignItems: "center" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  dateText: { fontFamily: "Inter_400Regular", fontSize: 11 },
  techText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  mobileText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  trackChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 2 },
  reasonBox: { padding: 8, marginBottom: 8 },
  notesBox: { padding: 8, marginBottom: 8 },
  reasonLabel: { fontFamily: "Inter_500Medium", fontSize: 11, marginBottom: 2 },
  reasonText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  resolveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10, gap: 6 },
  resolveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { padding: 24, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  disputeSummary: { padding: 12, gap: 4 },
  summaryText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  summaryReason: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, marginTop: 4 },
  notesLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  notesInput: { borderWidth: 1, padding: 10, minHeight: 72, textAlignVertical: "top" },
  actionRow: { gap: 10 },
  rejectBtn: { borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
});
