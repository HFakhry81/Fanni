import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import FanniButton from "@/components/FanniButton";
import { getApiBase } from "@/utils/api";

interface WalletStatRow {
  id: string;
  userId: string;
  pointsBalance: number;
  promotionalBalance: number;
  purchasedBalance: number;
  pendingBonusPoints: number;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
}

interface BonusGrant {
  id: string;
  technicianId: string;
  pointsAmount: number;
  message: string;
  status: "pending_ack" | "credited" | "cancelled";
  createdAt: string;
  techAcknowledgedAt?: string | null;
  creditedAt?: string | null;
}

function techLabel(row: WalletStatRow): string {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ");
  return name || row.mobile || row.userId;
}

function normalizeWalletRow(raw: Record<string, unknown>): WalletStatRow {
  const num = (v: unknown) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    id: String(raw.id),
    userId: String(raw.userId ?? raw.user_id),
    pointsBalance: num(raw.pointsBalance ?? raw.points_balance),
    promotionalBalance: num(raw.promotionalBalance ?? raw.promotional_balance),
    purchasedBalance: num(raw.purchasedBalance ?? raw.purchased_balance),
    pendingBonusPoints: num(raw.pendingBonusPoints ?? raw.pending_bonus),
    firstName: raw.firstName != null ? String(raw.firstName) : raw.first_name != null ? String(raw.first_name) : null,
    lastName: raw.lastName != null ? String(raw.lastName) : raw.last_name != null ? String(raw.last_name) : null,
    mobile: raw.mobile != null ? String(raw.mobile) : null,
  };
}

export default function TechBonusGrantsPanel({
  sessionToken,
  isRTL,
  colors,
}: {
  sessionToken: string | null;
  isRTL: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canGrantBonus, setCanGrantBonus] = useState(false);
  const [wallets, setWallets] = useState<WalletStatRow[]>([]);
  const [grants, setGrants] = useState<BonusGrant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<WalletStatRow | null>(null);
  const [pointsInput, setPointsInput] = useState("20");
  const [messageInput, setMessageInput] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!sessionToken) return;
    const base = getApiBase();
    if (!base) {
      setError(isRTL ? "عنوان الخادم غير متاح" : "API base URL unavailable");
      setLoading(false);
      return;
    }
    const authHeaders = { Authorization: `Bearer ${sessionToken}` };
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [permRes, statsRes, grantsRes] = await Promise.all([
        fetch(`${base}/api/admin/my-permissions`, { headers: authHeaders }),
        fetch(`${base}/api/admin/wallet-stats`, { headers: authHeaders }),
        fetch(`${base}/api/admin/wallet/bonus-grants`, { headers: authHeaders }),
      ]);
      if (permRes.ok) {
        const perm = await permRes.json() as { isSuperAdmin?: boolean; permissions?: string[] };
        const superAdmin = !!perm.isSuperAdmin;
        const manageWallet = perm.permissions?.includes("manage_wallet") ?? false;
        setCanGrantBonus(superAdmin || manageWallet);
      } else {
        setCanGrantBonus(false);
      }
      if (statsRes.ok) {
        const stats = await statsRes.json() as { wallets: Record<string, unknown>[] };
        setWallets((stats.wallets ?? []).map(normalizeWalletRow));
      } else {
        setWallets([]);
        setError(isRTL ? "تعذّر تحميل الأرصدة" : "Could not load balances");
      }
      if (grantsRes.ok) {
        const data = await grantsRes.json() as { grants: BonusGrant[] };
        setGrants(data.grants ?? []);
      }
    } catch {
      setError(isRTL ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, isRTL]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const openGrantModal = (tech: WalletStatRow) => {
    setSelectedTech(tech);
    setPointsInput("20");
    setMessageInput("");
    setConfirmStep(false);
    setModalOpen(true);
  };

  const sendGrant = async () => {
    if (!selectedTech || !sessionToken) return;
    const points = Number(pointsInput);
    if (!Number.isFinite(points) || points < 1) {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "أدخل عدد نقاط صحيح" : "Enter a valid points amount");
      return;
    }
    if (!messageInput.trim()) {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "الرسالة مطلوبة" : "Message is required");
      return;
    }
    const base = getApiBase();
    if (!base) return;
    setSending(true);
    try {
      const res = await fetch(`${base}/api/admin/wallet/bonus-grant`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: selectedTech.userId,
          pointsAmount: Math.round(points),
          message: messageInput.trim(),
        }),
      });
      const data = await res.json() as { error?: string; grant?: BonusGrant };
      if (!res.ok) {
        Alert.alert(isRTL ? "فشل الإرسال" : "Send failed", data.error ?? `HTTP ${res.status}`);
        return;
      }
      Alert.alert(
        isRTL ? "تم الإرسال" : "Sent",
        isRTL
          ? `أُرسلت مكافأة ${Math.round(points)} نقطة للفني ${techLabel(selectedTech)}.\nبانتظار تأكيد الاستلام من الفني.`
          : `Bonus of ${Math.round(points)} pts sent to ${techLabel(selectedTech)}.\nAwaiting technician confirmation.`,
      );
      setModalOpen(false);
      void load(true);
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "تعذر الاتصال بالخادم" : "Could not reach server");
    } finally {
      setSending(false);
    }
  };

  if (loading && wallets.length === 0) {
    return (
      <View style={{ padding: 32, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <View style={{ backgroundColor: "#E8F5E9", borderColor: "#2E7D32", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <Text style={{ color: "#1B5E20", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
          {isRTL
            ? "الأرصدة تتحدّث تلقائياً عند فتح الشاشة أو السحب للتحديث. المكافآت المعلّقة تُضاف بعد تأكيد الفني."
            : "Balances refresh when you open this screen or pull to refresh. Pending bonuses credit after technician confirmation."}
        </Text>
        {!canGrantBonus ? (
          <Text style={{ color: "#B45309", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 8, textAlign: isRTL ? "right" : "left" }}>
            {isRTL
              ? "زر «مكافأة» يظهر لـ Super Admin أو من لديه صلاحية manage_wallet."
              : "The Bonus button appears for Super Admin or manage_wallet permission."}
          </Text>
        ) : null}
      </View>

      {error ? (
        <TouchableOpacity onPress={() => void load()} style={{ padding: 16 }}>
          <Text style={{ color: "#DC2626", textAlign: "center" }}>{error}</Text>
        </TouchableOpacity>
      ) : null}

      {wallets.map((row) => (
        <View
          key={row.id}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
              {techLabel(row)}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
              {row.mobile ?? ""}
            </Text>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 6, textAlign: isRTL ? "right" : "left" }}>
              {row.pointsBalance} {isRTL ? "نقطة" : "pts"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>
              {isRTL
                ? `ترويجي ${row.promotionalBalance} · مشترى ${row.purchasedBalance}`
                : `Promo ${row.promotionalBalance} · Purchased ${row.purchasedBalance}`}
            </Text>
            {row.pendingBonusPoints > 0 ? (
              <Text style={{ color: "#B45309", fontFamily: "Inter_600SemiBold", fontSize: 11, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>
                {isRTL
                  ? `+${row.pendingBonusPoints} نقطة بانتظار تأكيد الفني`
                  : `+${row.pendingBonusPoints} pts pending technician ack`}
              </Text>
            ) : null}
          </View>
          {canGrantBonus ? (
            <TouchableOpacity
              onPress={() => openGrantModal(row)}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
              activeOpacity={0.85}
              testID="admin-bonus-grant-btn"
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {isRTL ? "مكافأة" : "Bonus"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      {canGrantBonus && grants.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 8, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "سجل المكافآت المرسلة" : "Sent bonus grants"}
          </Text>
          {grants.slice(0, 20).map((g) => (
            <View key={g.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: colors.muted }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }}>
                +{g.pointsAmount} {isRTL ? "نقطة" : "pts"} · {g.status}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4, textAlign: isRTL ? "right" : "left" }} numberOfLines={3}>
                {g.message}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground, textAlign: isRTL ? "right" : "left", marginBottom: 8 }}>
              {isRTL ? "مكافأة يدوية" : "Manual bonus"}
            </Text>
            {selectedTech ? (
              <Text style={{ color: colors.mutedForeground, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>
                {techLabel(selectedTech)}
              </Text>
            ) : null}

            {!confirmStep ? (
              <>
                <Text style={{ color: colors.foreground, marginBottom: 4, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "عدد النقاط" : "Points"}
                </Text>
                <TextInput
                  value={pointsInput}
                  onChangeText={setPointsInput}
                  keyboardType="numeric"
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 12, color: colors.foreground, textAlign: isRTL ? "right" : "left" }}
                />
                <Text style={{ color: colors.foreground, marginBottom: 4, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "رسالة للفني" : "Message to technician"}
                </Text>
                <TextInput
                  value={messageInput}
                  onChangeText={setMessageInput}
                  multiline
                  numberOfLines={4}
                  placeholder={isRTL ? "سبب المكافأة أو ملاحظة…" : "Reason or note…"}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, minHeight: 90, color: colors.foreground, textAlign: isRTL ? "right" : "left" }}
                />
                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 10, marginTop: 16 }}>
                  <FanniButton title={isRTL ? "إلغاء" : "Cancel"} variant="outline" onPress={() => setModalOpen(false)} style={{ flex: 1 }} />
                  <FanniButton
                    title={isRTL ? "مراجعة وإرسال" : "Review & send"}
                    onPress={() => setConfirmStep(true)}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={{ backgroundColor: colors.muted, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <Text style={{ color: colors.foreground, textAlign: isRTL ? "right" : "left" }}>
                    {isRTL
                      ? `تأكيد إرسال ${pointsInput} نقطة مكافأة (ترويجية) للفني مع الرسالة:`
                      : `Confirm sending ${pointsInput} promotional bonus points with message:`}
                  </Text>
                  <Text style={{ color: colors.primary, marginTop: 8, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }}>
                    «{messageInput.trim()}»
                  </Text>
                </View>
                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 10 }}>
                  <FanniButton title={isRTL ? "رجوع" : "Back"} variant="outline" onPress={() => setConfirmStep(false)} style={{ flex: 1 }} />
                  <FanniButton
                    title={isRTL ? "تأكيد الإرسال" : "Confirm send"}
                    onPress={() => void sendGrant()}
                    loading={sending}
                    style={{ flex: 1 }}
                    testID="admin-bonus-send-confirm"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
