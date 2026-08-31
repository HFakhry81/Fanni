import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import FanniButton from "@/components/FanniButton";
import { getApiBase } from "@/utils/api";

interface WalletStatRow {
  id: string;
  user_id: string;
  points_balance: number;
  first_name: string | null;
  last_name: string | null;
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
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return name || row.mobile || row.user_id;
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [wallets, setWallets] = useState<WalletStatRow[]>([]);
  const [grants, setGrants] = useState<BonusGrant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<WalletStatRow | null>(null);
  const [pointsInput, setPointsInput] = useState("20");
  const [messageInput, setMessageInput] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [sending, setSending] = useState(false);

  const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined;

  const load = useCallback(async () => {
    if (!sessionToken) return;
    const base = getApiBase();
    if (!base) {
      setError(isRTL ? "عنوان الخادم غير متاح" : "API base URL unavailable");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [permRes, statsRes, grantsRes] = await Promise.all([
        fetch(`${base}/api/admin/me/permissions`, { headers }),
        fetch(`${base}/api/admin/wallet-stats`, { headers }),
        fetch(`${base}/api/admin/wallet/bonus-grants`, { headers }),
      ]);
      if (permRes.ok) {
        const perm = await permRes.json() as { isSuperAdmin?: boolean };
        setIsSuperAdmin(!!perm.isSuperAdmin);
      }
      if (statsRes.ok) {
        const stats = await statsRes.json() as { wallets: WalletStatRow[] };
        setWallets(stats.wallets ?? []);
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
    }
  }, [sessionToken, isRTL]);

  useEffect(() => { void load(); }, [load]);

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
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: selectedTech.user_id,
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
      void load();
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "تعذر الاتصال بالخادم" : "Could not reach server");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={{ padding: 32, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
      <View style={{ backgroundColor: "#E8F5E9", borderColor: "#2E7D32", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <Text style={{ color: "#1B5E20", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
          {isRTL
            ? "مكافأة يدوية (Super Admin): تُرسل للفني مع رسالة — يُضاف الرصيد بعد أن يضغط الفني «استلام المكافأة»."
            : "Manual bonus (Super Admin): sent with a message — points credit after the technician taps «Receive bonus»."}
        </Text>
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
              {row.points_balance} {isRTL ? "نقطة" : "pts"}
            </Text>
          </View>
          {isSuperAdmin ? (
            <TouchableOpacity
              onPress={() => openGrantModal(row)}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
              activeOpacity={0.85}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {isRTL ? "مكافأة" : "Bonus"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      {isSuperAdmin && grants.length > 0 ? (
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
