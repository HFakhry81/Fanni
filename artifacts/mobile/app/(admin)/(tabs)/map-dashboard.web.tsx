import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import AppHeader from "@/components/AppHeader";
import VectorIcon from "@/components/VectorIcon";

export default function AdminMapDashboard() {
  const colors = useColors();
  const { isRTL } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={isRTL ? "خريطة المراقبة الحية" : "Live Monitor Map"} />
      <View style={[styles.body, { backgroundColor: colors.muted }]}>
        <VectorIcon name="map" size={56} color={colors.border} />
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isRTL ? "الخريطة التفاعلية" : "Live Map"}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {isRTL
            ? "هذه الميزة متاحة على تطبيق الهاتف فقط"
            : "This feature is available on the mobile app only"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22, maxWidth: 280 },
});
