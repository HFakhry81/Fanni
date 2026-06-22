import React from "react";
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon, { type IconName, toIconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniButton from "@/components/FanniButton";

interface CategoryMeta {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string | null;
}

export default function RegisterSuccessScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const { name, role, categories, categoryMeta } = useLocalSearchParams<{
    name: string;
    role: string;
    categories: string;
    categoryMeta: string;
  }>();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const isTech = role === "technician";
  const firstName = name ? name.trim().split(/\s+/)[0] : "";

  let parsedMeta: CategoryMeta[] = [];
  if (isTech && categoryMeta) {
    try {
      const parsed = JSON.parse(categoryMeta);
      if (Array.isArray(parsed)) parsedMeta = parsed;
    } catch {
      parsedMeta = [];
    }
  }

  let savedCategoryIds: string[] = [];
  if (isTech && categories) {
    try {
      const parsed = JSON.parse(categories);
      if (Array.isArray(parsed)) savedCategoryIds = parsed;
    } catch {
      savedCategoryIds = [];
    }
  }

  const displayCategories = parsedMeta.length > 0
    ? parsedMeta
    : savedCategoryIds.map((id) => ({ id, nameAr: id, nameEn: id, icon: null }));

  const handleGetStarted = () => {
    if (isTech) {
      router.replace("/(tech)/map");
    } else {
      router.replace("/(client)/home");
    }
  };

  const handleBackToLogin = () => {
    router.replace("/login");
  };

  const AMBER = "#F59E0B";
  const AMBER_BG = "#FEF3C7";

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
          {isTech ? (
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: AMBER_BG, borderRadius: 60 },
              ]}
            >
              <VectorIcon name="clock" size={60} color={AMBER} />
            </View>
          ) : (
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.success + "22", borderRadius: 60 },
              ]}
            >
              <VectorIcon name="check" size={60} color={colors.success} />
            </View>
          )}

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
                { color: isTech ? AMBER : colors.primary, fontFamily: "Inter_700Bold", textAlign: "center" },
              ]}
            >
              {t("register.welcomeName")} {firstName}!
            </Text>
          ) : null}

          {isTech ? (
            <View style={[styles.pendingBadge, { backgroundColor: AMBER_BG, borderColor: AMBER }]}>
              <VectorIcon name="clock" size={14} color={AMBER} />
              <Text style={[styles.pendingBadgeText, { color: AMBER, fontFamily: "Inter_600SemiBold" }]}>
                {t("register.techPendingBadge")}
              </Text>
            </View>
          ) : null}

          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" },
            ]}
          >
            {isTech ? t("register.techNextSteps") : t("register.clientNextSteps")}
          </Text>

          {isTech && displayCategories.length > 0 ? (
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

              <View style={styles.chipsRow}>
                {displayCategories.map((cat) => {
                  const label = isRTL ? cat.nameAr : cat.nameEn;
                  const iconName = toIconName(cat.icon ?? "tool");
                  return (
                    <View
                      key={cat.id}
                      style={[styles.chip, { backgroundColor: AMBER_BG, borderColor: AMBER }]}
                    >
                      <VectorIcon name={iconName} size={14} color={AMBER} />
                      <Text
                        style={[styles.chipText, { color: AMBER, fontFamily: "Inter_600SemiBold" }]}
                      >
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : isTech && displayCategories.length === 0 ? (
            <View
              style={[
                styles.categoriesCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
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
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.btnArea, { paddingHorizontal: 24 }]}>
        {isTech ? (
          <>
            <FanniButton
              title={t("register.goHome")}
              onPress={handleGetStarted}
              fullWidth
            />
            <TouchableOpacity
              style={styles.loginLink}
              onPress={handleBackToLogin}
              activeOpacity={0.7}
            >
              <Text style={[styles.loginLinkText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {t("register.backToLogin")}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <FanniButton
            title={t("register.goHome")}
            onPress={handleGetStarted}
            fullWidth
          />
        )}
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
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  pendingBadgeText: { fontSize: 13 },
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
  chipText: { fontSize: 13 },
  nudgeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  nudgeText: { fontSize: 13, lineHeight: 20, flex: 1 },
  btnArea: { paddingBottom: 16, gap: 8 },
  loginLink: {
    alignItems: "center",
    paddingVertical: 10,
  },
  loginLinkText: { fontSize: 14 },
});
