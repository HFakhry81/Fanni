import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import AppHeader from "@/components/AppHeader";

/** Job invoices retired — platform accounting is commission-only (lead unlock / points). */
export default function TechInvoicesScreen() {
  const colors = useColors();
  const { isRTL } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={isRTL ? "المحفظة والعمولة" : "Wallet & Commission"} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "فواتير الصيانة غير مستخدمة" : "Job invoices are not used"}
        </Text>
        <Text style={[styles.copy, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL
            ? "محاسبة المنصة تقتصر على عمولة كشف Lead (النقاط). استخدم تبويب المحفظة لرصيدك وشحن النقاط."
            : "Platform accounting is limited to lead-unlock commission (points). Use the Wallet tab for balance and top-ups."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 20, gap: 10 },
  title: { fontFamily: "Inter_700Bold", fontSize: 16 },
  copy: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 },
});
