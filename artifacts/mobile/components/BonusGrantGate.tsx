import React, { useCallback, useState } from "react";
import { Modal, View, Text, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import FanniButton from "@/components/FanniButton";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/utils/api";

interface PendingGrant {
  id: string;
  pointsAmount: number;
  message: string;
  createdAt: string;
}

export default function BonusGrantGate() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken, user, refreshUser } = useAuth();
  const [grant, setGrant] = useState<PendingGrant | null>(null);
  const [loading, setLoading] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);

  const loadPending = useCallback(async () => {
    if (!sessionToken || user?.role !== "technician") {
      setGrant(null);
      return;
    }
    const base = getApiBase();
    if (!base) return;
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/wallet/bonus-grants/pending`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        setGrant(null);
        return;
      }
      const data = await res.json() as { grants: PendingGrant[] };
      setGrant(data.grants?.[0] ?? null);
    } catch {
      setGrant(null);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, user?.role]);

  useFocusEffect(useCallback(() => {
    void loadPending();
  }, [loadPending]));

  const acknowledge = async () => {
    if (!grant || !sessionToken) return;
    const base = getApiBase();
    if (!base) return;
    setAckLoading(true);
    try {
      const res = await fetch(`${base}/api/wallet/bonus-grants/${grant.id}/acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        setGrant(null);
        return;
      }
      await res.json();
      setGrant(null);
      await refreshUser?.();
      void loadPending();
    } finally {
      setAckLoading(false);
    }
  };

  if (!grant) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground, textAlign: isRTL ? "right" : "left", marginBottom: 8 }}>
            {isRTL ? "🎁 مكافأة من الإدارة" : "🎁 Bonus from admin"}
          </Text>
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center", marginVertical: 8 }}>
            +{grant.pointsAmount} {isRTL ? "نقطة" : "pts"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 22, textAlign: isRTL ? "right" : "left", marginBottom: 16 }}>
            {grant.message}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: isRTL ? "right" : "left", marginBottom: 16 }}>
            {isRTL
              ? "اضغط «استلام المكافأة» لإضافة النقاط إلى محفظتك."
              : "Tap «Receive bonus» to credit your wallet."}
          </Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : (
            <FanniButton
              title={isRTL ? "استلام المكافأة" : "Receive bonus"}
              onPress={() => void acknowledge()}
              loading={ackLoading}
              testID="bonus-grant-confirm"
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
