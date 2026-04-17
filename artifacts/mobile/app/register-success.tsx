import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniButton from "@/components/FanniButton";

export default function RegisterSuccessScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: botPad },
      ]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: colors.success, borderRadius: 60 },
          ]}
        >
          <Feather name="check" size={60} color="#FFF" />
        </View>
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" },
          ]}
        >
          {t("register.success")}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" },
          ]}
        >
          {t("register.successMsg")}
        </Text>
      </View>
      <View style={[styles.btnArea, { paddingHorizontal: 24 }]}>
        <FanniButton
          title={t("login.submit")}
          onPress={() => router.replace("/welcome")}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: { fontSize: 26, marginBottom: 16 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  btnArea: { paddingBottom: 16 },
});
