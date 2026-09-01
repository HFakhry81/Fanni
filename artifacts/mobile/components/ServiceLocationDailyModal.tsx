import React, { useCallback, useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as Location from "expo-location";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useTechWs } from "@/context/TechWsContext";
import { getApiBase } from "@/utils/api";
import VectorIcon from "@/components/VectorIcon";

type ServiceMode = "registered" | "last_work" | "current";

interface ServiceLocationState {
  needsDailyPrompt: boolean;
  hasRegisteredCoords: boolean;
  hasLastWorkCoords: boolean;
  mode: ServiceMode | null;
}

export default function ServiceLocationDailyModal() {
  const colors = useColors();
  const { user, isRTL } = useApp();
  const { sessionToken } = useAuth();
  const { refreshRoutingRegistration } = useTechWs();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<ServiceLocationState | null>(null);

  const load = useCallback(async () => {
    if (!sessionToken || user?.type !== "technician" || !user.isApproved) return;
    const base = getApiBase();
    const res = await fetch(`${base}/api/technician/service-location`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) return;
    const data = await res.json() as ServiceLocationState;
    setState(data);
    setVisible(data.needsDailyPrompt);
  }, [sessionToken, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (mode: ServiceMode) => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (mode === "current") {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert(
            isRTL ? "الموقع مطلوب" : "Location required",
            isRTL ? "فعّل صلاحية الموقع لاستخدام الموقع الحالي." : "Enable location permission to use current GPS.",
          );
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }
      const base = getApiBase();
      const res = await fetch(`${base}/api/technician/service-location`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode, latitude, longitude }),
      });
      if (!res.ok) throw new Error("save failed");
      refreshRoutingRegistration();
      setVisible(false);
    } catch {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "تعذّر حفظ موقع الخدمة. حاول مرة أخرى." : "Could not save service location. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !state) return null;

  const Option = ({ mode, title, subtitle, disabled }: { mode: ServiceMode; title: string; subtitle: string; disabled?: boolean }) => (
    <TouchableOpacity
      disabled={disabled || loading}
      onPress={() => void submit(mode)}
      style={[styles.option, { borderColor: colors.border, backgroundColor: colors.card, opacity: disabled ? 0.45 : 1 }]}
    >
      <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>{title}</Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>{subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <VectorIcon name="map-pin" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground, textAlign: "center" }]}>
            {isRTL ? "موقع الخدمة اليوم" : "Today's service location"}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: "center" }]}>
            {isRTL
              ? "اختر موقع الخدمة الذي ستُفلتر عليه الطلبات المتاحة اليوم."
              : "Choose which location filters your available orders today."}
          </Text>
          <Option
            mode="registered"
            title={isRTL ? "استخدام الموقع المسجل" : "Use registered location"}
            subtitle={isRTL ? "من بيانات حسابك (المحافظة والمنطقة)" : "From your profile governorate and area"}
            disabled={!state.hasRegisteredCoords && !user?.governorate}
          />
          <Option
            mode="last_work"
            title={isRTL ? "استخدام آخر موقع عمل" : "Use last work location"}
            subtitle={isRTL ? "من آخر طلب أنهيته" : "From your most recently completed job"}
            disabled={!state.hasLastWorkCoords}
          />
          <Option
            mode="current"
            title={isRTL ? "استخدام الموقع الحالي" : "Use current GPS location"}
            subtitle={isRTL ? "موقعك الآن عبر GPS" : "Your live GPS position"}
          />
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  card: { borderRadius: 16, padding: 20, gap: 10 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, marginBottom: 8 },
  option: { borderWidth: 1, borderRadius: 12, padding: 14 },
});
