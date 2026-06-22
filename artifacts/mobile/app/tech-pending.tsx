import React from "react";
import {
  View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import VectorIcon from "@/components/VectorIcon";

export default function TechPendingScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const AMBER = "#F59E0B";
  const AMBER_BG = "#FEF3C7";

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "";

  const handleLogout = () => {
    Alert.alert(
      isRTL ? "تسجيل الخروج" : "Sign Out",
      isRTL ? "هل أنت متأكد أنك تريد تسجيل الخروج؟" : "Are you sure you want to sign out?",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "تسجيل خروج" : "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/welcome");
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    router.replace("/(tech)/map");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: botPad }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: AMBER_BG }]}>
            <VectorIcon name="clock" size={64} color={AMBER} />
          </View>

          <View style={[styles.badge, { backgroundColor: AMBER_BG, borderColor: AMBER }]}>
            <VectorIcon name="clock" size={13} color={AMBER} />
            <Text style={[styles.badgeText, { color: AMBER, fontFamily: "Inter_600SemiBold" }]}>
              {t("register.techPendingBadge")}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
            {t("tech.pendingTitle")}
          </Text>

          {firstName ? (
            <Text style={[styles.greeting, { color: AMBER, fontFamily: "Inter_600SemiBold", textAlign: "center" }]}>
              {isRTL ? `مرحباً، ${firstName}` : `Hello, ${firstName}`}
            </Text>
          ) : null}

          <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            {t("tech.pendingDesc")}
          </Text>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <VectorIcon name="check-circle" size={18} color={colors.success ?? colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "تم استلام بيانات تسجيلك بنجاح" : "Your registration details have been received"}
              </Text>
            </View>
            <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <VectorIcon name="search" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "جاري مراجعة بياناتك من قِبل فريقنا" : "Our team is reviewing your details"}
              </Text>
            </View>
            <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <VectorIcon name="bell" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "ستتلقى إشعاراً فور تفعيل حسابك" : "You'll be notified once your account is activated"}
              </Text>
            </View>
          </View>

          <Text style={[styles.contactHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            {t("tech.pendingContact")}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.btnArea, { paddingHorizontal: 24 }]}>
        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: colors.primary, borderRadius: colors.radius ?? 12 }]}
          onPress={handleRefresh}
          activeOpacity={0.85}
        >
          <VectorIcon name="refresh-cw" size={16} color="#FFF" />
          <Text style={[styles.refreshBtnText, { fontFamily: "Inter_700Bold" }]}>
            {isRTL ? "تحديث الحالة" : "Refresh Status"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <VectorIcon name="log-out" size={15} color={colors.mutedForeground} />
          <Text style={[styles.logoutText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {t("tech.pendingLogout")}
          </Text>
        </TouchableOpacity>
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
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 16,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 13 },
  title: { fontSize: 24, marginTop: 4 },
  greeting: { fontSize: 16, marginTop: -4 },
  desc: { fontSize: 15, lineHeight: 24, marginTop: 4 },
  infoCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginTop: 8,
  },
  infoRow: {
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: { fontSize: 14, lineHeight: 20, flex: 1 },
  contactHint: { fontSize: 13, lineHeight: 20 },
  btnArea: { paddingBottom: 16, gap: 8 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  refreshBtnText: { color: "#FFF", fontSize: 16 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  logoutText: { fontSize: 14 },
});
