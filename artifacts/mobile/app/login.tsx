import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import FanniButton from "@/components/FanniButton";
import FanniInput from "@/components/FanniInput";
import AppHeader from "@/components/AppHeader";

const AUTH_TOKEN_KEY = "fanni_auth_token";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { user, isLoading, isAuthenticated, login, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

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

  const handleLocalLogin = async () => {
    if (!identifier.trim() || !password) {
      setLocalError(isRTL ? "يرجى إدخال البريد الإلكتروني/الهاتف وكلمة المرور" : "Please enter your email/mobile and password");
      return;
    }
    setLocalError("");
    setLocalLoading(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/auth/login-with-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await res.json();
      if (data.token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
        await refreshUser();
      } else {
        setLocalError(
          data.error === "Invalid credentials"
            ? (isRTL ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email/mobile or password")
            : (isRTL ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again"),
        );
      }
    } catch {
      setLocalError(isRTL ? "تعذر الاتصال بالخادم" : "Could not reach server");
    } finally {
      setLocalLoading(false);
    }
  };

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
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
            style={{ marginTop: 4 }}
          />
        </View>

        <View style={[styles.divider, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {isRTL ? "أو" : "or"}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "الدخول بكلمة المرور" : "Sign in with Password"}
          </Text>

          <FanniInput
            label={t("forgot.identifier")}
            value={identifier}
            onChangeText={(v) => { setIdentifier(v); setLocalError(""); }}
            placeholder={isRTL ? "example@email.com أو 01XXXXXXXXX" : "example@email.com or 01XXXXXXXXX"}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={{ position: "relative" }}>
            <FanniInput
              label={t("login.password")}
              value={password}
              onChangeText={(v) => { setPassword(v); setLocalError(""); }}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={[styles.eyeBtn, { right: isRTL ? undefined : 12, left: isRTL ? 12 : undefined }]}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {!!localError && (
            <Text style={[styles.error, { color: colors.destructive, textAlign: isRTL ? "right" : "left" }]}>
              {localError}
            </Text>
          )}

          <FanniButton
            title={t("login.submit")}
            onPress={handleLocalLogin}
            loading={localLoading}
            fullWidth
          />

          <TouchableOpacity
            onPress={() => router.push("/forgot-password")}
            style={styles.forgotBtn}
          >
            <Text style={[styles.forgotText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              {t("login.forgot")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  content: {
    padding: 24,
    gap: 16,
  },
  logoContainer: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
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
  divider: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  forgotBtn: { alignItems: "center", paddingVertical: 4 },
  forgotText: { fontSize: 14 },
  eyeBtn: { position: "absolute", bottom: 18, zIndex: 1 },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -4 },
});
