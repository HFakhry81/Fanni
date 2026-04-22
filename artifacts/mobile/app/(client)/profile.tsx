import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import AppHeader from "@/components/AppHeader";
import { EGYPT_LOCATIONS } from "@/constants/egyptLocations";

export default function ClientProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language } = useApp();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const govData = user?.governorate ? EGYPT_LOCATIONS.find((g) => g.id === user.governorate) : null;
  const areaData = govData && user?.area ? govData.areas.find((a) => a.id === user.area) : null;
  const neighborhoodData = areaData && user?.district
    ? areaData.neighborhoods.find((n) => n.id === user.district)
    : null;
  const govText = govData ? (isRTL ? govData.ar : govData.en) : (isRTL ? "الإسكندرية" : "Alexandria");
  const neighborhoodText = neighborhoodData
    ? (isRTL ? neighborhoodData.ar : neighborhoodData.en)
    : areaData ? (isRTL ? areaData.ar : areaData.en) : "";

  const handleLogout = async () => {
    await setUser(null);
    router.replace("/welcome");
  };

  const menuItems = [
    { icon: "list",       label: t("profile.previousOrders"),   color: colors.primary,   action: () => router.push("/(client)/orders") },
    { icon: "file-text",  label: t("profile.previousInvoices"), color: colors.secondary, action: () => router.push("/(client)/invoices") },
    { icon: "bar-chart-2",label: t("profile.reports"),          color: "#7C5CBF",        action: () => {} },
    { icon: "edit-2",     label: t("profile.edit"),             color: "#22A36B",        action: () => {} },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("profile.title")} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Profile hero */}
        <View style={[styles.profileHero, { backgroundColor: colors.darkMid }]}>
          <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 34 }}>
                {(user?.name?.[0] ?? "U").toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 12 }}>{user?.name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4 }}>{user?.mobile}</Text>
          {user?.email && (
            <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>{user.email}</Text>
          )}
          {/* Edit badge */}
          <TouchableOpacity style={[styles.editBadge, { backgroundColor: colors.primary }]}>
            <Feather name="edit-2" size={13} color="#FFF" />
            <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>
              {t("profile.edit")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          {/* Language toggle */}
          <View style={[styles.langCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={[styles.langIconWrap, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
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

          {/* Address card */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <Feather name="map-pin" size={18} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "عنوان المنزل" : "Home Address"}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                {govText}{neighborhoodText ? ` — ${neighborhoodText}` : ""}
              </Text>
              {user?.address ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                  {user.address}
                </Text>
              ) : null}
            </View>
            <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          </View>

          {/* Menu items */}
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
              onPress={item.action}
              activeOpacity={0.8}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + "18", borderRadius: 10 }]}>
                <Feather name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0, textAlign: isRTL ? "right" : "left" }}>
                {item.label}
              </Text>
              <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}

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
  profileHero: { alignItems: "center", paddingVertical: 28, paddingBottom: 32 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  editBadge: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20 },
  menuSection: { padding: 16, gap: 10 },
  langCard: { padding: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center" },
  langIconWrap: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  langToggle: { padding: 3 },
  langOption: { paddingVertical: 6, paddingHorizontal: 12 },
  menuItem: { padding: 16, borderWidth: 1.5, alignItems: "center" },
  menuIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  infoCard: { padding: 14, borderWidth: 1.5, alignItems: "center" },
  logoutBtn: { padding: 16, borderWidth: 2, alignItems: "center" },
});
