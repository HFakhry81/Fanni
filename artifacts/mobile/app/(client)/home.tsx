import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, ImageBackground,
  ImageSourcePropType,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import VectorIcon, { type IconName, toIconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import AppHeader from "@/components/AppHeader";

type Category = {
  id: string;
  icon?: IconName;
  image?: ImageSourcePropType;
  color: string;
};

const CATEGORIES: Category[] = [
  { id: "electricity", image: require("@/assets/images/icon_electricity.webp"), color: "#F5A623" },
  { id: "plumbing",    image: require("@/assets/images/icon_plumbing.webp"),    color: "#4DADD9" },
  { id: "ac",          image: require("@/assets/images/icon_ac.webp"),          color: "#2B8FBB" },
  { id: "carpentry",   image: require("@/assets/images/icon_carpentry.webp"),   color: "#8B6F47" },
  { id: "appliances",  image: require("@/assets/images/icon_appliances.webp"),  color: "#7C5CBF" },
  { id: "painting",    image: require("@/assets/images/icon_painting.webp"),    color: "#E84393" },
  { id: "pest",        image: require("@/assets/images/icon_pest.webp"),        color: "#22A36B" },
  { id: "flooring",    image: require("@/assets/images/icon_flooring.webp"),    color: "#E67E22" },
];

const SUB_CATEGORIES: Record<string, { id: string; imageKey: string; image: ImageSourcePropType; label_ar: string; label_en: string }[]> = {
  electricity: [
    { id: "wiring",        imageKey: "sub_electrical_wiring", image: require("@/assets/images/sub_electrical_wiring.webp"), label_ar: "توصيلات كهربائية", label_en: "Electrical Wiring" },
    { id: "computers",     imageKey: "sub_computers",         image: require("@/assets/images/sub_computers.webp"),         label_ar: "أجهزة كمبيوتر",    label_en: "Computers" },
    { id: "washingmachine",imageKey: "sub_washing_machine",   image: require("@/assets/images/sub_washing_machine.webp"),   label_ar: "غسالات",            label_en: "Washing Machines" },
    { id: "heater",        imageKey: "sub_water_heater",      image: require("@/assets/images/sub_water_heater.webp"),      label_ar: "سخانات",            label_en: "Water Heaters" },
  ],
  ac: [
    { id: "repair",   imageKey: "sub_ac_repair",   image: require("@/assets/images/sub_ac_repair.webp"),   label_ar: "صيانة مكيفات", label_en: "AC Repair" },
    { id: "cleaning", imageKey: "sub_ac_cleaning", image: require("@/assets/images/sub_ac_cleaning.webp"), label_ar: "تنظيف مكيفات", label_en: "AC Cleaning" },
  ],
  plumbing: [
    { id: "pipes",    imageKey: "sub_pipes",    image: require("@/assets/images/sub_pipes.webp"),   label_ar: "مواسير",      label_en: "Pipes" },
    { id: "sanitary", imageKey: "sub_sanitary", image: require("@/assets/images/sub_sanitary.webp"), label_ar: "أدوات صحية", label_en: "Sanitary" },
  ],
  carpentry: [
    { id: "doors",     imageKey: "sub_doors",     image: require("@/assets/images/sub_doors.webp"),     label_ar: "أبواب", label_en: "Doors" },
    { id: "furniture", imageKey: "sub_furniture", image: require("@/assets/images/sub_furniture.webp"), label_ar: "أثاث",  label_en: "Furniture" },
  ],
  appliances: [
    { id: "fridge",     imageKey: "sub_fridge",     image: require("@/assets/images/sub_fridge.webp"),     label_ar: "ثلاجات",       label_en: "Refrigerators" },
    { id: "dishwasher", imageKey: "sub_dishwasher", image: require("@/assets/images/sub_dishwasher.webp"), label_ar: "غسالة أطباق", label_en: "Dishwasher" },
  ],
  painting: [
    { id: "interior", imageKey: "sub_interior_paint", image: require("@/assets/images/sub_interior_paint.webp"), label_ar: "دهان داخلي", label_en: "Interior Paint" },
    { id: "exterior", imageKey: "sub_exterior_paint", image: require("@/assets/images/sub_exterior_paint.webp"), label_ar: "دهان خارجي", label_en: "Exterior Paint" },
  ],
  pest: [
    { id: "insects", imageKey: "sub_insects", image: require("@/assets/images/sub_insects.webp"), label_ar: "حشرات", label_en: "Insects" },
    { id: "rodents", imageKey: "sub_rodents", image: require("@/assets/images/sub_rodents.webp"), label_ar: "قوارض", label_en: "Rodents" },
  ],
  flooring: [
    { id: "tiles",   imageKey: "sub_tiles",   image: require("@/assets/images/sub_tiles.webp"),   label_ar: "سيراميك", label_en: "Tiles" },
    { id: "parquet", imageKey: "sub_parquet", image: require("@/assets/images/sub_parquet.webp"), label_ar: "باركيه",  label_en: "Parquet" },
  ],
};

function ImageCard({
  cat, isSelected, label, radius, onPress,
}: {
  cat: Category; isSelected: boolean; label: string; radius: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      key={cat.id}
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.catCardFull,
        {
          borderRadius: radius,
          borderWidth: 2.5,
          borderColor: isSelected ? "#F5A623" : "transparent",
          overflow: "hidden",
        },
      ]}
    >
      <ImageBackground
        source={cat.image!}
        style={styles.catBgFull}
        resizeMode="cover"
      >
        {isSelected && (
          <View style={styles.catSelectedOverlay} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={styles.catGradientOverlay}
        >
          <Text style={styles.catLabelOnImage} numberOfLines={2}>
            {label}
          </Text>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );
}

export default function ClientHomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const subs = selectedCat ? (SUB_CATEGORIES[selectedCat] ?? []) : [];

  const govName = isRTL ? user?.governorateNameAr : user?.governorateNameEn;
  const areaName = isRTL ? user?.areaNameAr : user?.areaNameEn;
  const locationText = govName
    ? `${govName}${areaName ? ` — ${areaName}` : ""}`
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
            <VectorIcon name="tool" size={32} color={colors.primary} />
          </View>
        </View>

        {/* Location chip */}
        <TouchableOpacity
          style={[styles.locationChip, { backgroundColor: colors.accentBlue, borderColor: colors.secondary, borderRadius: 30, flexDirection: isRTL ? "row-reverse" : "row" }]}
          activeOpacity={0.8}
          onPress={() => router.push("/(client)/profile")}
        >
          <VectorIcon name="map-pin" size={14} color={colors.secondary} />
          <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
            {locationText}
          </Text>
          <VectorIcon name="chevron-down" size={13} color={colors.secondary} style={{ marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }} />
        </TouchableOpacity>

        {/* Categories */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "اختر نوع الخدمة" : "Select Service"}
        </Text>
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCat === cat.id;
            const label = t(`cat.${cat.id}`);
            const toggle = () => setSelectedCat(isSelected ? null : cat.id);

            if (cat.image) {
              return (
                <ImageCard
                  key={cat.id}
                  cat={cat}
                  isSelected={isSelected}
                  label={label}
                  radius={colors.radius}
                  onPress={toggle}
                />
              );
            }

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
                onPress={toggle}
                activeOpacity={0.8}
              >
                <View style={[styles.catIconWrap, { backgroundColor: isSelected ? "rgba(245,166,35,0.15)" : cat.color + "18", borderRadius: 12 }]}>
                  <VectorIcon name={toIconName(cat.icon)} size={26} color={isSelected ? colors.primary : cat.color} />
                </View>
                <Text style={{ color: isSelected ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 11, textAlign: "center", marginTop: 6 }} numberOfLines={2}>
                  {label}
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
                  style={[styles.subCard, { borderRadius: colors.radius, overflow: "hidden" }]}
                  onPress={() => router.push({ pathname: "/new-order", params: { category: selectedCat, subCategory: isRTL ? sub.label_ar : sub.label_en, subImageKey: sub.imageKey } })}
                  activeOpacity={0.85}
                >
                  <ImageBackground
                    source={sub.image}
                    style={styles.subBg}
                    resizeMode="cover"
                  >
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.62)"]}
                      style={styles.subGradient}
                    >
                      <Text style={styles.subLabelOnImage} numberOfLines={2}>
                        {isRTL ? sub.label_ar : sub.label_en}
                      </Text>
                    </LinearGradient>
                  </ImageBackground>
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
          {([
            { icon: "list",      label: t("nav.orders"),   route: "/(client)/orders",   color: colors.primary },
            { icon: "file-text", label: t("nav.invoices"), route: "/(client)/invoices", color: colors.secondary },
            { icon: "user",      label: t("nav.profile"),  route: "/(client)/profile",  color: "#22A36B" },
          ] satisfies { icon: IconName; label: string; route: string; color: string }[]).map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.quickCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, borderWidth: 1.5 }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIcon, { backgroundColor: item.color + "15", borderRadius: 10 }]}>
                <VectorIcon name={item.icon} size={20} color={item.color} />
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
  container:    { flex: 1 },
  avatar:       { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: 16, paddingTop: 16 },
  heroBanner:   { flexDirection: "row", alignItems: "center", padding: 18, marginBottom: 10 },
  locationChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, marginBottom: 20 },
  bannerIcon:   { width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },

  catCard:      { width: "22%", paddingVertical: 14, paddingHorizontal: 4, alignItems: "center", minWidth: 76 },
  catIconWrap:  { width: 50, height: 50, alignItems: "center", justifyContent: "center" },

  catCardFull:        { width: "22%", minWidth: 76, height: 110 },
  catBgFull:          { flex: 1, justifyContent: "flex-end" },
  catGradientOverlay: { backgroundColor: "rgba(0,0,0,0.52)", paddingVertical: 8, paddingHorizontal: 4, alignItems: "center" },
  catLabelOnImage:    { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10, textAlign: "center" },
  catSelectedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(245,166,35,0.22)" },

  subSection:       { marginBottom: 24 },
  subGrid:          { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  subCard:          { width: "47%", height: 120 },
  subBg:            { flex: 1, justifyContent: "flex-end" },
  subGradient:      { paddingVertical: 10, paddingHorizontal: 8, alignItems: "center" },
  subLabelOnImage:  { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 12, textAlign: "center" },
  quickRow:         { gap: 10, marginBottom: 24 },
  quickCard:        { flex: 1, paddingVertical: 16, alignItems: "center" },
  quickIcon:        { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
