import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import StarRating from "@/components/StarRating";
import AppHeader from "@/components/AppHeader";

export default function TechProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language } = useApp();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleLogout = async () => {
    await setUser(null);
    router.replace("/welcome");
  };

  const stats = [
    { label: isRTL ? "الطلبات" : "Orders",       value: "24",                           color: colors.primary   },
    { label: isRTL ? "سنوات الخبرة" : "Years Exp", value: `${user?.experience ?? 5}`,    color: colors.secondary },
    { label: isRTL ? "التقييم" : "Rating",         value: "4.8",                          color: "#22A36B"        },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("profile.title")} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.darkMid }]}>
          <View style={[styles.avatarRing, { borderColor: colors.secondary }]}>
            <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 34 }}>
                {(user?.name?.[0] ?? "T").toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 12 }}>{user?.name}</Text>
          <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 4 }}>
            {user?.profession} — {user?.specialty}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 }}>{user?.mobile}</Text>
          <View style={{ marginTop: 12 }}>
            <StarRating rating={4.8} readonly size={20} />
          </View>
          {/* Badges */}
          <View style={[styles.badgesRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.badge, { backgroundColor: "rgba(77,173,217,0.2)", borderColor: colors.secondary }]}>
              <Feather name="shield" size={12} color={colors.secondary} />
              <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 4 }}>
                {isRTL ? "معتمد" : "Verified"}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "rgba(245,166,35,0.2)", borderColor: colors.primary }]}>
              <Feather name="star" size={12} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 4 }}>
                {isRTL ? "متميز" : "Top Rated"}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {stats.map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <Text style={{ color: stat.color, fontFamily: "Inter_700Bold", fontSize: 24 }}>{stat.value}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 4 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.menuSection}>
          {/* Language toggle */}
          <View style={[styles.langCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <Feather name="globe" size={18} color={colors.secondary} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              {t("profile.language")}
            </Text>
            <View style={[styles.langToggle, { backgroundColor: colors.muted, borderRadius: 20, flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {(["ar", "en"] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langOption, { backgroundColor: language === lang ? colors.primary : "transparent", borderRadius: 16 }]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={{ color: language === lang ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {lang === "ar" ? "العربية" : "English"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Specialty info */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.accent, borderRadius: 10 }]}>
              <Feather name="tool" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "التخصص" : "Specialty"}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                {user?.specialty ?? (isRTL ? "صيانة مكيفات" : "AC Maintenance")}
              </Text>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: "#FFCCCC", flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FFE6E6", borderRadius: 10 }]}>
              <Feather name="log-out" size={18} color={colors.destructive} />
            </View>
            <Text style={{ color: colors.destructive, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0, textAlign: isRTL ? "right" : "left" }}>
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
  content: {},
  hero: { alignItems: "center", paddingVertical: 28, paddingBottom: 28 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  badgesRow: { marginTop: 14, gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  statsRow: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 16, borderWidth: 1.5 },
  menuSection: { padding: 16, gap: 10 },
  langCard: { padding: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center" },
  infoCard: { padding: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center" },
  menuIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  langToggle: { padding: 3 },
  langOption: { paddingVertical: 6, paddingHorizontal: 12 },
  logoutBtn: { padding: 16, borderWidth: 2, alignItems: "center" },
});
