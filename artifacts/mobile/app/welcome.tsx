import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { LinearGradient } from "expo-linear-gradient";

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, setLanguage, language } = useApp();
  const insets = useSafeAreaInsets();

  const topPad =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const toggleLang = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.dark }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16 },
        ]}
      >
        <TouchableOpacity onPress={toggleLang} style={styles.langBtn}>
          <Text style={[styles.langText, { color: colors.primaryForeground }]}>
            {language === "ar" ? "EN" : "عر"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logoSection}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text
          style={[
            styles.appName,
            { color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {t("app.name")}
        </Text>
        <Text
          style={[
            styles.tagline,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              textAlign: "center",
            },
          ]}
        >
          {t("app.tagline")}
        </Text>
      </View>

      <View
        style={[
          styles.actions,
          {
            paddingBottom: botPad + 24,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.btn,
            styles.primaryBtn,
            { backgroundColor: colors.primary, borderRadius: colors.radius },
          ]}
          onPress={() =>
            router.push({ pathname: "/login", params: { type: "client" } })
          }
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.btnText,
              { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("welcome.client")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.btn,
            styles.secondaryBtn,
            { backgroundColor: colors.secondary, borderRadius: colors.radius },
          ]}
          onPress={() =>
            router.push({ pathname: "/login", params: { type: "technician" } })
          }
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.btnText,
              { color: "#FFFFFF", fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("welcome.technician")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.btn,
            styles.outlineBtn,
            { borderColor: colors.border, borderRadius: colors.radius },
          ]}
          onPress={() =>
            router.push({ pathname: "/login", params: { type: "admin" } })
          }
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.btnText,
              { color: colors.secondary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("welcome.admin")}
          </Text>
        </TouchableOpacity>

        <View style={[styles.divider, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
            {isRTL ? "أو" : "or"}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity
          onPress={() => router.push("/register")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.registerLink,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("welcome.register")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    alignItems: "flex-end",
  },
  langBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  langText: { fontSize: 14, fontWeight: "600" },
  logoSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  appName: { fontSize: 42, marginBottom: 8 },
  tagline: { fontSize: 16, opacity: 0.7 },
  actions: {
    paddingTop: 32,
    paddingHorizontal: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  btn: {
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtn: {},
  secondaryBtn: {},
  outlineBtn: {
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  btnText: { fontSize: 16 },
  divider: {
    alignItems: "center",
    marginVertical: 8,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  registerLink: { fontSize: 15, textAlign: "center", marginTop: 4 },
});
