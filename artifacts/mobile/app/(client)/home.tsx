import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const CATEGORIES = [
  { id: "electricity", icon: "zap", color: "#FFB800" },
  { id: "plumbing", icon: "droplet", color: "#0099CC" },
  { id: "ac", icon: "wind", color: "#00AAFF" },
  { id: "carpentry", icon: "tool", color: "#8B4513" },
  { id: "appliances", icon: "cpu", color: "#6C5CE7" },
  { id: "painting", icon: "edit-3", color: "#E84393" },
  { id: "pest", icon: "alert-triangle", color: "#00B894" },
  { id: "flooring", icon: "layers", color: "#FDCB6E" },
];

const SUB_CATEGORIES: Record<string, { id: string; icon: string; label_ar: string; label_en: string }[]> = {
  electricity: [
    { id: "wiring", icon: "zap", label_ar: "توصيلات كهربائية", label_en: "Electrical Wiring" },
    { id: "computers", icon: "monitor", label_ar: "أجهزة كمبيوتر", label_en: "Computers" },
    { id: "washingmachine", icon: "loader", label_ar: "غسالات", label_en: "Washing Machines" },
    { id: "heater", icon: "thermometer", label_ar: "سخانات", label_en: "Water Heaters" },
  ],
  ac: [
    { id: "repair", icon: "tool", label_ar: "صيانة مكيفات", label_en: "AC Repair" },
    { id: "cleaning", icon: "wind", label_ar: "تنظيف مكيفات", label_en: "AC Cleaning" },
  ],
  plumbing: [
    { id: "pipes", icon: "droplet", label_ar: "مواسير", label_en: "Pipes" },
    { id: "sanitary", icon: "archive", label_ar: "أدوات صحية", label_en: "Sanitary" },
  ],
  carpentry: [
    { id: "doors", icon: "maximize-2", label_ar: "أبواب", label_en: "Doors" },
    { id: "furniture", icon: "package", label_ar: "أثاث", label_en: "Furniture" },
  ],
  appliances: [
    { id: "fridge", icon: "thermometer", label_ar: "ثلاجات", label_en: "Refrigerators" },
    { id: "dishwasher", icon: "loader", label_ar: "غسالة أطباق", label_en: "Dishwasher" },
  ],
  painting: [
    { id: "interior", icon: "edit-3", label_ar: "دهان داخلي", label_en: "Interior Paint" },
    { id: "exterior", icon: "home", label_ar: "دهان خارجي", label_en: "Exterior Paint" },
  ],
  pest: [
    { id: "insects", icon: "alert-triangle", label_ar: "حشرات", label_en: "Insects" },
    { id: "rodents", icon: "alert-circle", label_ar: "قوارض", label_en: "Rodents" },
  ],
  flooring: [
    { id: "tiles", icon: "grid", label_ar: "سيراميك", label_en: "Tiles" },
    { id: "parquet", icon: "layers", label_ar: "باركيه", label_en: "Parquet" },
  ],
};

export default function ClientHomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const insets = useSafeAreaInsets();

  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const handleCategorySelect = (catId: string) => {
    setSelectedCat(catId);
  };

  const handleSubCategorySelect = (subCat: { id: string; label_ar: string; label_en: string }) => {
    const catLabel = isRTL ? t(`cat.${selectedCat}`) : t(`cat.${selectedCat}`);
    const subLabel = isRTL ? subCat.label_ar : subCat.label_en;
    router.push({
      pathname: "/new-order",
      params: { category: selectedCat, subCategory: subLabel },
    });
  };

  const subs = selectedCat ? SUB_CATEGORIES[selectedCat] ?? [] : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.dark, paddingTop: topPad + 8 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {isRTL ? "مرحباً" : "Welcome"}
          </Text>
          <Text
            style={{
              color: "#FFF",
              fontFamily: "Inter_700Bold",
              fontSize: 20,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {user?.name ?? t("app.name")}
          </Text>
        </View>
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 18 }}>
            {(user?.name?.[0] ?? "U").toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 100 : 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Categories title */}
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              textAlign: isRTL ? "right" : "left",
            },
          ]}
        >
          {isRTL ? "اختر نوع الخدمة" : "Select Service Type"}
        </Text>

        {/* Categories Grid */}
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catCard,
                {
                  backgroundColor:
                    selectedCat === cat.id ? colors.primary : colors.card,
                  borderRadius: colors.radius,
                  borderColor:
                    selectedCat === cat.id ? colors.primary : colors.border,
                  borderWidth: selectedCat === cat.id ? 0 : 1.5,
                },
              ]}
              onPress={() => handleCategorySelect(cat.id)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.catIconWrap,
                  {
                    backgroundColor:
                      selectedCat === cat.id ? "rgba(255,255,255,0.2)" : cat.color + "22",
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather
                  name={cat.icon as any}
                  size={28}
                  color={selectedCat === cat.id ? "#FFF" : cat.color}
                />
              </View>
              <Text
                style={{
                  color: selectedCat === cat.id ? "#FFF" : colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                  textAlign: "center",
                  marginTop: 6,
                }}
                numberOfLines={2}
              >
                {t(`cat.${cat.id}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sub Categories */}
        {selectedCat && subs.length > 0 && (
          <View style={styles.subSection}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                  textAlign: isRTL ? "right" : "left",
                },
              ]}
            >
              {isRTL ? "اختر التخصص" : "Select Specialty"}
            </Text>
            <View style={styles.subGrid}>
              {subs.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.subCard,
                    {
                      backgroundColor: colors.card,
                      borderRadius: colors.radius,
                      borderColor: colors.border,
                      borderWidth: 1.5,
                    },
                  ]}
                  onPress={() => handleSubCategorySelect(sub)}
                  activeOpacity={0.8}
                >
                  <Feather name={sub.icon as any} size={22} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 6,
                    }}
                    numberOfLines={2}
                  >
                    {isRTL ? sub.label_ar : sub.label_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Quick access */}
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              textAlign: isRTL ? "right" : "left",
              marginTop: 8,
            },
          ]}
        >
          {isRTL ? "وصول سريع" : "Quick Access"}
        </Text>
        <View style={[styles.quickRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            { icon: "list", label: t("nav.orders"), route: "/(client)/orders" },
            { icon: "file-text", label: t("nav.invoices"), route: "/(client)/invoices" },
            { icon: "user", label: t("nav.profile"), route: "/(client)/profile" },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.quickCard,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                  borderColor: colors.border,
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <Feather name={item.icon as any} size={22} color={colors.primary} />
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 18, marginBottom: 14 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  catCard: {
    width: "22%",
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: "center",
    minWidth: 76,
  },
  catIconWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  subSection: { marginBottom: 24 },
  subGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  subCard: {
    width: "47%",
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  quickRow: {
    gap: 12,
    marginBottom: 24,
  },
  quickCard: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
});
