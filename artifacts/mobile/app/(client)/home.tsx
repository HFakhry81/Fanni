import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Image, ImageSourcePropType,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import AppHeader from "@/components/AppHeader";
import { EGYPT_LOCATIONS } from "@/constants/egyptLocations";

type Category = {
  id: string;
  icon?: string;
  image?: ImageSourcePropType;
  color: string;
};

const CATEGORIES: Category[] = [
  { id: "electricity", icon: "zap",           color: "#F5A623" },
  { id: "plumbing",    image: require("@/assets/images/icon_plumbing.png"),  color: "#4DADD9" },
  { id: "ac",          image: require("@/assets/images/icon_ac.png"),        color: "#2B8FBB" },
  { id: "carpentry",   image: require("@/assets/images/icon_carpentry.png"), color: "#8B6F47" },
  { id: "appliances",  icon: "cpu",            color: "#7C5CBF" },
  { id: "painting",    icon: "edit-3",         color: "#E84393" },
  { id: "pest",        icon: "alert-triangle", color: "#22A36B" },
  { id: "flooring",    icon: "layers",         color: "#E67E22" },
];

const SUB_CATEGORIES: Record<string, { id: string; icon: string; label_ar: string; label_en: string }[]> = {
  electricity: [
    { id: "wiring",       icon: "zap",         label_ar: "توصيلات كهربائية", label_en: "Electrical Wiring" },
    { id: "computers",    icon: "monitor",     label_ar: "أجهزة كمبيوتر",    label_en: "Computers" },
    { id: "washingmachine",icon: "loader",     label_ar: "غسالات",            label_en: "Washing Machines" },
    { id: "heater",       icon: "thermometer", label_ar: "سخانات",            label_en: "Water Heaters" },
  ],
  ac:          [
    { id: "repair",   icon: "tool", label_ar: "صيانة مكيفات", label_en: "AC Repair" },
    { id: "cleaning", icon: "wind", label_ar: "تنظيف مكيفات", label_en: "AC Cleaning" },
  ],
  plumbing:    [
    { id: "pipes",    icon: "droplet", label_ar: "مواسير",      label_en: "Pipes" },
    { id: "sanitary", icon: "archive", label_ar: "أدوات صحية", label_en: "Sanitary" },
  ],
  carpentry:   [
    { id: "doors",     icon: "maximize-2", label_ar: "أبواب", label_en: "Doors" },
    { id: "furniture", icon: "package",    label_ar: "أثاث",  label_en: "Furniture" },
  ],
  appliances:  [
    { id: "fridge",     icon: "thermometer", label_ar: "ثلاجات",       label_en: "Refrigerators" },
    { id: "dishwasher", icon: "loader",      label_ar: "غسالة أطباق", label_en: "Dishwasher" },
  ],
  painting:    [
    { id: "interior", icon: "edit-3", label_ar: "دهان داخلي", label_en: "Interior Paint" },
    { id: "exterior", icon: "home",   label_ar: "دهان خارجي", label_en: "Exterior Paint" },
  ],
  pest:        [
    { id: "insects", icon: "alert-triangle", label_ar: "حشرات", label_en: "Insects" },
    { id: "rodents", icon: "alert-circle",   label_ar: "قوارض", label_en: "Rodents" },
  ],
  flooring:    [
    { id: "tiles",   icon: "grid",   label_ar: "سيراميك", label_en: "Tiles" },
    { id: "parquet", icon: "layers", label_ar: "باركيه",  label_en: "Parquet" },
  ],
};

export default function ClientHomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const subs = selectedCat ? (SUB_CATEGORIES[selectedCat] ?? []) : [];

  const govLabel = user?.governorate
    ? EGYPT_LOCATIONS.find((g) => g.id === user.governorate)
    : null;
  const areaLabel = govLabel && user?.area
    ? govLabel.areas.find((a) => a.id === user.area)
    : null;
  const neighborhoodLabel = areaLabel && user?.district
    ? areaLabel.neighborhoods.find((n) => n.id === user.district)
    : null;
  const locationText = govLabel
    ? isRTL
      ? `${govLabel.ar}${neighborhoodLabel ? ` — ${neighborhoodLabel.ar}` : areaLabel ? ` — ${areaLabel.ar}` : ""}`
      : `${govLabel.en}${neighborhoodLabel ? ` — ${neighborhoodLabel.en}` : areaLabel ? ` — ${areaLabel.en}` : ""}`
    : isRTL ? "الإسكندرية — مصر" : "Alexandria — Egypt";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={user?.name ?? t("app.name")}
        subtitle={isRTL ? "مرحباً بك في فني" : "Welcome to Fanni"}
        showLangToggle
        rightElement={
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>
              {(user?.name?.[0] ?? "U").toUpperCase()}
            </Text>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero banner */}
        <View style={[styles.heroBanner, { backgroundColor: colors.darkMid, borderRadius: colors.radius }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "اطلب فنيك الآن" : "Book a Technician"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "خدمة سريعة وموثوقة في متناول يدك" : "Fast & trusted home maintenance"}
            </Text>
          </View>
          <View style={[styles.bannerIcon, { backgroundColor: "rgba(245,166,35,0.15)" }]}>
            <Feather name="tool" size={32} color={colors.primary} />
          </View>
        </View>

        {/* Location chip */}
        <TouchableOpacity
          style={[styles.locationChip, { backgroundColor: colors.accentBlue, borderColor: colors.secondary, borderRadius: 30, flexDirection: isRTL ? "row-reverse" : "row" }]}
          activeOpacity={0.8}
          onPress={() => router.push("/(client)/profile")}
        >
          <Feather name="map-pin" size={14} color={colors.secondary} />
          <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
            {locationText}
          </Text>
          <Feather name="chevron-down" size={13} color={colors.secondary} style={{ marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }} />
        </TouchableOpacity>

        {/* Categories */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "اختر نوع الخدمة" : "Select Service"}
        </Text>
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCat === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catCard,
                  {
                    backgroundColor: isSelected ? colors.darkMid : colors.card,
                    borderRadius: colors.radius,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setSelectedCat(isSelected ? null : cat.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.catIconWrap, { backgroundColor: isSelected ? "rgba(245,166,35,0.15)" : cat.color + "18", borderRadius: 12 }]}>
                  {cat.image ? (
                    <Image
                      source={cat.image}
                      style={[styles.catImage, isSelected && { tintColor: colors.primary }]}
                      resizeMode="contain"
                    />
                  ) : (
                    <Feather name={cat.icon as any} size={26} color={isSelected ? colors.primary : cat.color} />
                  )}
                </View>
                <Text style={{ color: isSelected ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 11, textAlign: "center", marginTop: 6 }} numberOfLines={2}>
                  {t(`cat.${cat.id}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sub-categories */}
        {selectedCat && subs.length > 0 && (
          <View style={styles.subSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {isRTL ? "اختر التخصص" : "Choose Specialty"}
            </Text>
            <View style={styles.subGrid}>
              {subs.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.subCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.secondary, borderWidth: 1.5 }]}
                  onPress={() => router.push({ pathname: "/new-order", params: { category: selectedCat, subCategory: isRTL ? sub.label_ar : sub.label_en } })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.subIconWrap, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
                    <Feather name={sub.icon as any} size={20} color={colors.secondary} />
                  </View>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center", marginTop: 8 }} numberOfLines={2}>
                    {isRTL ? sub.label_ar : sub.label_en}
                  </Text>
                  <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={14} color={colors.secondary} style={{ marginTop: 6 }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Quick access */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left", marginTop: 4 }]}>
          {isRTL ? "وصول سريع" : "Quick Access"}
        </Text>
        <View style={[styles.quickRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            { icon: "list",       label: t("nav.orders"),   route: "/(client)/orders",   color: colors.primary },
            { icon: "file-text",  label: t("nav.invoices"), route: "/(client)/invoices", color: colors.secondary },
            { icon: "user",       label: t("nav.profile"),  route: "/(client)/profile",  color: "#22A36B" },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.quickCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, borderWidth: 1.5 }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIcon, { backgroundColor: item.color + "15", borderRadius: 10 }]}>
                <Feather name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 6, textAlign: "center" }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  heroBanner: { flexDirection: "row", alignItems: "center", padding: 18, marginBottom: 10 },
  locationChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, marginBottom: 20 },
  bannerIcon: { width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  catCard: { width: "22%", paddingVertical: 14, paddingHorizontal: 4, alignItems: "center", minWidth: 76 },
  catIconWrap: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  catImage: { width: 34, height: 34 },
  subSection: { marginBottom: 24 },
  subGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  subCard: { width: "47%", paddingVertical: 18, paddingHorizontal: 12, alignItems: "center" },
  subIconWrap: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  quickRow: { gap: 10, marginBottom: 24 },
  quickCard: { flex: 1, paddingVertical: 16, alignItems: "center" },
  quickIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
