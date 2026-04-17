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
import StarRating from "@/components/StarRating";

export default function TechProfileScreen() {
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("profile.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Profile card */}
        <View style={[styles.profileSection, { backgroundColor: colors.dark }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 36 }}>
              {(user?.name?.[0] ?? "T").toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 12 }}>
            {user?.name}
          </Text>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 4 }}>
            {user?.profession} — {user?.specialty}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 }}>
            {user?.mobile}
          </Text>
          <View style={{ marginTop: 12, alignItems: "center" }}>
            <StarRating rating={4.8} readonly size={20} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4, fontFamily: "Inter_400Regular" }}>
              {isRTL ? "4.8 من 5 نجوم" : "4.8 out of 5 stars"}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={[styles.statsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            { label: isRTL ? "الطلبات" : "Orders", value: "24" },
            { label: isRTL ? "سنوات الخبرة" : "Experience", value: `${user?.experience ?? 5}` },
            { label: isRTL ? "التقييم" : "Rating", value: "4.8" },
          ].map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 22 }}>
                {stat.value}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.menuSection}>
          {/* Language */}
          <View style={[styles.langCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1, textAlign: isRTL ? "right" : "left" }}>
              {t("profile.language")}
            </Text>
            <View style={[styles.langToggle, { backgroundColor: colors.muted, borderRadius: 20, flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {(["ar", "en"] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langOption,
                    { backgroundColor: language === lang ? colors.primary : "transparent", borderRadius: 16 },
                  ]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={{ color: language === lang ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {lang === "ar" ? t("profile.arabic") : t("profile.english")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[
              styles.menuItem,
              { backgroundColor: "#FFE6E6", borderRadius: colors.radius, borderColor: "#FFCCCC", flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FFCCCC", borderRadius: 10 }]}>
              <Feather name="log-out" size={18} color={colors.destructive} />
            </View>
            <Text style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
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
  profileSection: { alignItems: "center", paddingBottom: 30, paddingTop: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.3)" },
  statsRow: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 14, borderWidth: 1.5 },
  menuSection: { padding: 16, gap: 10 },
  langCard: { padding: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 12 },
  langToggle: { padding: 3, gap: 2 },
  langOption: { paddingVertical: 6, paddingHorizontal: 14 },
  menuItem: { padding: 16, borderWidth: 1.5, alignItems: "center" },
  menuIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
});
