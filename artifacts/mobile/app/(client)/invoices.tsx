import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import AppHeader from "@/components/AppHeader";

/** Job invoices retired — clients settle service fees outside platform billing. */
export default function ClientInvoicesScreen() {
  const colors = useColors();
  const { isRTL } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={isRTL ? "الطلبات" : "Orders"} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "لا توجد فواتير صيانة داخل التطبيق" : "No in-app job invoices"}
        </Text>
        <Text style={[styles.copy, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL
            ? "المنصة لا تُصدر فواتير مواد/أجور للصيانة. تابع طلباتك من تبويب الطلبات."
            : "The platform does not issue materials/labour invoices for jobs. Track your requests from the Orders tab."}
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
