import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showHome?: boolean;
  showLogout?: boolean;
  showLangToggle?: boolean;
  rightElement?: React.ReactNode;
  onBack?: () => void;
}

export default function AppHeader({
  title,
  subtitle,
  showBack = false,
  showHome = false,
  showLogout = false,
  showLangToggle = false,
  rightElement,
  onBack,
}: AppHeaderProps) {
  const router = useRouter();
  const colors = useColors();
  const { isRTL, setUser, setLanguage, language } = useApp();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const handleLogout = async () => {
    await setUser(null);
    router.replace("/welcome");
  };

  const handleHome = () => {
    router.replace("/welcome");
  };

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace("/welcome");
  };

  return (
    <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.dark }]}>
      {/* Left side */}
      <View style={[styles.side, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {showBack && (
          <TouchableOpacity style={styles.iconBtn} onPress={handleBack}>
            <Text style={styles.arrowIcon}>{isRTL ? "→" : "←"}</Text>
          </TouchableOpacity>
        )}
        {showHome && (
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "rgba(77,173,217,0.2)" }]} onPress={handleHome}>
            <Text style={styles.homeIcon}>🏠</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Center */}
      <View style={styles.center}>
        <Text style={[styles.title, { fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right side */}
      <View style={[styles.side, styles.sideRight, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {showLangToggle && (
          <TouchableOpacity
            style={[styles.langBtn, { borderColor: "rgba(245,166,35,0.4)", backgroundColor: "rgba(245,166,35,0.1)" }]}
            onPress={() => setLanguage(language === "ar" ? "en" : "ar")}
          >
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 12 }}>
              {language === "ar" ? "EN" : "عر"}
            </Text>
          </TouchableOpacity>
        )}
        {rightElement}
        {showLogout && (
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "rgba(229,62,62,0.15)" }]} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>⏻</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  side: { alignItems: "center", gap: 6, minWidth: 36 },
  sideRight: { justifyContent: "flex-end" },
  center: { flex: 1, alignItems: "center" },
  title: { color: "#FFFFFF", fontSize: 17, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 1, textAlign: "center" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  arrowIcon: { fontSize: 20, color: "#FFFFFF", fontWeight: "700" },
  homeIcon: { fontSize: 18 },
  logoutIcon: { fontSize: 18, color: "#FF6B6B" },
  langBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
});
