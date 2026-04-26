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

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, setLanguage, language } = useApp();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const toggleLang = () => setLanguage(language === "ar" ? "en" : "ar");

  return (
    <View style={[styles.container, { backgroundColor: colors.dark }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={toggleLang} style={[styles.langBtn, { borderColor: "rgba(245,166,35,0.5)", backgroundColor: "rgba(245,166,35,0.1)" }]}>
          <Text style={[styles.langText, { color: colors.primary }]}>
            {language === "ar" ? "EN" : "عر"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hero section */}
      <View style={styles.heroSection}>
        {/* Logo card */}
        <View style={[styles.logoCard, { backgroundColor: colors.navyMid, borderColor: "rgba(245,166,35,0.3)" }]}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>

        {/* Brand name */}
        <View style={styles.brandRow}>
          <Text style={[styles.appNameAr, { color: "#FFFFFF", fontFamily: "Inter_700Bold" }]}>
            فني
          </Text>
          <View style={[styles.brandDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.appNameEn, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
            Fanni
          </Text>
        </View>

        <Text style={[styles.tagline, { color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" }]}>
          {t("app.tagline")}
        </Text>

        {/* Feature pills — plain text/emoji icons, always visible on Android */}
        <View style={styles.pills}>
          {[
            { icon: "⚡", label: isRTL ? "خدمة سريعة" : "Fast Service" },
            { icon: "★", label: isRTL ? "فنيون معتمدون" : "Certified Techs" },
            { icon: "✓", label: isRTL ? "مضمون" : "Guaranteed" },
          ].map((pill) => (
            <View key={pill.label} style={[styles.pill, { backgroundColor: "rgba(245,166,35,0.12)", borderColor: "rgba(245,166,35,0.25)" }]}>
              <Text style={{ color: colors.primary, fontSize: 12 }}>{pill.icon}</Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter_500Medium", fontSize: 11, marginLeft: 5 }}>
                {pill.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Actions card */}
      <View style={[styles.actions, { backgroundColor: colors.card, paddingBottom: botPad + 24 }]}>
        {/* Decorative top bar */}
        <View style={styles.handleBar}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <Text style={[styles.loginTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "ابدأ الآن" : "Get Started"}
        </Text>

        {/* Client login button */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          onPress={() => router.replace("/login")}
          activeOpacity={0.85}
        >
          <View style={[styles.btnIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Text style={styles.btnEmoji}>🏠</Text>
          </View>
          <Text style={[styles.btnText, { color: "#FFF", fontFamily: "Inter_600SemiBold", flex: 1, textAlign: isRTL ? "right" : "left" }]}>
            {t("welcome.client")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 20 }}>{isRTL ? "‹" : "›"}</Text>
        </TouchableOpacity>

        {/* Technician login button */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.dark, borderRadius: colors.radius }]}
          onPress={() => router.replace("/login")}
          activeOpacity={0.85}
        >
          <View style={[styles.btnIcon, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
            <Text style={styles.btnEmoji}>🔧</Text>
          </View>
          <Text style={[styles.btnText, { color: "#FFF", fontFamily: "Inter_600SemiBold", flex: 1, textAlign: isRTL ? "right" : "left" }]}>
            {t("welcome.technician")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 20 }}>{isRTL ? "‹" : "›"}</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
            {isRTL ? "أو" : "or"}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity
          style={[styles.registerBtn, { borderColor: colors.primary, borderRadius: colors.radius }]}
          onPress={() => router.push("/register")}
          activeOpacity={0.8}
        >
          <View style={[styles.btnIcon, { backgroundColor: "rgba(245,166,35,0.12)" }]}>
            <Text style={styles.btnEmoji}>✨</Text>
          </View>
          <Text style={[styles.btnText, { color: colors.primary, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: isRTL ? "right" : "left" }]}>
            {t("welcome.register")}
          </Text>
          <Text style={{ color: colors.primary, fontSize: 20, opacity: 0.7 }}>{isRTL ? "‹" : "›"}</Text>
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
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  langText: { fontSize: 14, fontWeight: "600" },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  logoCard: {
    width: 110,
    height: 110,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#F5A623",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
  },
  logo: { width: 110, height: 110 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  appNameAr: { fontSize: 38 },
  brandDot: { width: 8, height: 8, borderRadius: 4 },
  appNameEn: { fontSize: 28 },
  tagline: { fontSize: 15, textAlign: "center", marginBottom: 24 },
  pills: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  actions: {
    paddingHorizontal: 20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  handleBar: { alignItems: "center", paddingBottom: 16 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  loginTitle: { fontSize: 22, marginBottom: 16 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 12,
  },
  btnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnEmoji: { fontSize: 18 },
  btnText: { fontSize: 16 },
  divider: {
    alignItems: "center",
    marginVertical: 12,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
    gap: 12,
    borderWidth: 1.5,
  },
});
