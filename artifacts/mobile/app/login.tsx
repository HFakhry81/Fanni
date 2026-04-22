import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { user, isLoading, isAuthenticated, login } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (!user.role) {
        router.replace("/select-role");
      } else if (user.role === "client") {
        router.replace("/(client)/home");
      } else if (user.role === "technician") {
        router.replace("/(tech)/map");
      } else if (user.role === "admin") {
        router.replace("/(admin)/dashboard");
      }
    }
  }, [isLoading, isAuthenticated, user]);

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("login.title")}
        showBack
        onBack={() => router.back()}
        showLangToggle
      />

      <View style={[styles.content, { paddingBottom: botPad + 24 }]}>
        <View style={styles.logoContainer}>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
            {t("app.name")}
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("app.tagline")}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "تسجيل الدخول بحساب Replit" : "Sign in with Replit"}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }]}>
            {isRTL
              ? "استخدم حسابك على Replit للدخول الآمن إلى تطبيق فني"
              : "Use your Replit account to securely access the Fanni app"}
          </Text>

          <FanniButton
            title={isRTL ? "الدخول عبر Replit" : "Continue with Replit"}
            onPress={login}
            fullWidth
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 24,
  },
  logoContainer: {
    alignItems: "center",
    gap: 8,
  },
  appName: {
    fontSize: 48,
  },
  tagline: {
    fontSize: 16,
  },
  card: {
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
});
