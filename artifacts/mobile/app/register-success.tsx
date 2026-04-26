import React from "react";
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, Image, ImageSourcePropType } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniButton from "@/components/FanniButton";

const CATEGORY_IMAGES: Record<string, ImageSourcePropType> = {
  electricity: require("@/assets/images/icon_electricity.webp"),
  plumbing:    require("@/assets/images/icon_plumbing.webp"),
  ac:          require("@/assets/images/icon_ac.webp"),
  carpentry:   require("@/assets/images/icon_carpentry.webp"),
  appliances:  require("@/assets/images/icon_appliances.webp"),
  painting:    require("@/assets/images/icon_painting.webp"),
  pest:        require("@/assets/images/icon_pest.webp"),
  flooring:    require("@/assets/images/icon_flooring.webp"),
};

export default function RegisterSuccessScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const { name, role, categories } = useLocalSearchParams<{
    name: string;
    role: string;
    categories: string;
  }>();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const isTech = role === "technician";
  const firstName = name ? name.trim().split(/\s+/)[0] : "";
  const nextSteps = isTech ? t("register.techNextSteps") : t("register.clientNextSteps");

  let savedCategories: string[] = [];
  if (isTech && categories) {
    try {
      const parsed = JSON.parse(categories);
      if (Array.isArray(parsed)) savedCategories = parsed;
    } catch {
      savedCategories = [];
    }
  }

  const handleGetStarted = () => {
    if (isTech) {
      router.replace("/(tech)/map");
    } else {
      router.replace("/(client)/home");
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: botPad },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.success, borderRadius: 60 },
            ]}
          >
            <VectorIcon name="check" size={60} color="#FFF" />
          </View>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" },
            ]}
          >
            {t("register.success")}
          </Text>
          {firstName ? (
            <Text
              style={[
                styles.nameLabel,
                { color: colors.primary, fontFamily: "Inter_700Bold", textAlign: "center" },
              ]}
            >
              {t("register.welcomeName")} {firstName}!
            </Text>
          ) : null}
          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" },
            ]}
          >
            {nextSteps}
          </Text>

          {isTech ? (
            <View
              style={[
                styles.categoriesCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.categoriesTitle,
                  { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {t("register.savedCategories")}
              </Text>

              {savedCategories.length > 0 ? (
                <View style={styles.chipsRow}>
                  {savedCategories.map((key) => (
                    <View
                      key={key}
                      style={[styles.chip, { backgroundColor: colors.primary + "22", borderColor: colors.primary }]}
                    >
                      {CATEGORY_IMAGES[key] ? (
                        <Image
                          source={CATEGORY_IMAGES[key]}
                          style={styles.chipIcon}
                          resizeMode="cover"
                        />
                      ) : null}
                      <Text
                        style={[styles.chipText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}
                      >
                        {t(`cat.${key}`)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.nudgeRow}>
                  <VectorIcon name="info" size={16} color={colors.mutedForeground} />
                  <Text
                    style={[
                      styles.nudgeText,
                      { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {t("register.noCategoriesHint")}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.editCategoriesBtn, { borderColor: colors.primary }]}
                onPress={() => router.push("/(tech)/profile?openCategories=1")}
                activeOpacity={0.7}
              >
                <VectorIcon name="edit-2" size={14} color={colors.primary} />
                <Text style={[styles.editCategoriesText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  {t("register.editCategories")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.btnArea, { paddingHorizontal: 24 }]}>
        <FanniButton
          title={t("register.goHome")}
          onPress={handleGetStarted}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: { fontSize: 26, marginBottom: 12 },
  nameLabel: { fontSize: 20, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 24 },
  categoriesCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  categoriesTitle: { fontSize: 15 },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  chipText: { fontSize: 13 },
  nudgeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  nudgeText: { fontSize: 13, lineHeight: 20, flex: 1 },
  editCategoriesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  editCategoriesText: { fontSize: 13 },
  btnArea: { paddingBottom: 16 },
});
