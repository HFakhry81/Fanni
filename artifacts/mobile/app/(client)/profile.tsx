import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export default function ClientProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language } = useApp();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleLogout = async () => {
    await setUser(null);
    router.replace("/welcome");
  };

  const menuItems = [
    { icon: "list", label: t("profile.previousOrders"), action: () => router.push("/(client)/orders") },
    { icon: "file-text", label: t("profile.previousInvoices"), action: () => router.push("/(client)/invoices") },
    { icon: "bar-chart-2", label: t("profile.reports"), action: () => {} },
    { icon: "edit-2", label: t("profile.edit"), action: () => {} },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("profile.title")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
      >
        {/* Avatar */}
        <View style={[styles.avatarSection, { backgroundColor: colors.dark }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 36 }}>
              {(user?.name?.[0] ?? "U").toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 12 }}>
            {user?.name}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 4 }}>
            {user?.mobile}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 }}>
            {user?.email}
          </Text>
        </View>

        <View style={styles.menuSection}>
          {/* Language Toggle */}
          <View
            style={[
              styles.langCard,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                flex: 1,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("profile.language")}
            </Text>
            <View style={[styles.langToggle, { backgroundColor: colors.muted, borderRadius: 20, flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {(["ar", "en"] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langOption,
                    {
                      backgroundColor: language === lang ? colors.primary : "transparent",
                      borderRadius: 16,
                    },
                  ]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text
                    style={{
                      color: language === lang ? "#FFF" : colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                    }}
                  >
                    {lang === "ar" ? t("profile.arabic") : t("profile.english")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Menu items */}
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                  borderColor: colors.border,
                  flexDirection: isRTL ? "row-reverse" : "row",
                },
              ]}
              onPress={item.action}
              activeOpacity={0.8}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.accent, borderRadius: 10 }]}>
                <Feather name={item.icon as any} size={18} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 15,
                  flex: 1,
                  marginLeft: isRTL ? 0 : 12,
                  marginRight: isRTL ? 12 : 0,
                }}
              >
                {item.label}
              </Text>
              <Feather
                name={isRTL ? "chevron-left" : "chevron-right"}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          ))}

          {/* Logout */}
          <TouchableOpacity
            style={[
              styles.menuItem,
              {
                backgroundColor: "#FFE6E6",
                borderRadius: colors.radius,
                borderColor: "#FFCCCC",
                flexDirection: isRTL ? "row-reverse" : "row",
              },
            ]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FFCCCC", borderRadius: 10 }]}>
              <Feather name="log-out" size={18} color={colors.destructive} />
            </View>
            <Text
              style={{
                color: colors.destructive,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                flex: 1,
                marginLeft: isRTL ? 0 : 12,
                marginRight: isRTL ? 12 : 0,
              }}
            >
              {t("profile.logout")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { fontSize: 22 },
  content: {},
  avatarSection: {
    alignItems: "center",
    paddingBottom: 30,
    paddingTop: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  menuSection: { padding: 16, gap: 10 },
  langCard: {
    padding: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  langToggle: {
    padding: 3,
    gap: 2,
  },
  langOption: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  menuItem: {
    padding: 16,
    borderWidth: 1.5,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  menuIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
});
