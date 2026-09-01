import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { saveSuspensionNotice, clearSuspensionNotice } from "@/utils/suspensionNotice";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import FanniButton from "@/components/FanniButton";
import FanniInput from "@/components/FanniInput";
import AppHeader from "@/components/AppHeader";
import KeyboardAwareScrollViewCompat from "@/components/KeyboardAwareScrollViewCompat";
import { getApiBase } from "@/utils/api";
import { setAuthToken } from "@/utils/authTokenStorage";
import { APP_IDENTITY, getAppVersionLabel } from "@/constants/appIdentity";
import { normalizeLoginIdentifierValue } from "@/utils/phone";

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { user, isLoading, isAuthenticated, refreshUser } = useAuth();
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
        router.replace("/(admin)/(tabs)/dashboard");
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleLocalLogin = async () => {
    const rawIdentifier = identifier.trim();
    if (!rawIdentifier || !password) {
      setLocalError(
        isRTL
          ? "يرجى إدخال البريد الإلكتروني/الهاتف وكلمة المرور"
          : "Please enter your email/mobile and password",
      );
      return;
    }
    setLocalError("");
    setLocalLoading(true);
    try {
      const apiBase = getApiBase();
      if (!apiBase) {
        setLocalError(
          isRTL ? "عنوان الخادم غير مضبوط في التطبيق" : "API base URL is not configured",
        );
        return;
      }
      const loginIdentifier = normalizeLoginIdentifierValue(rawIdentifier);
      const res = await fetch(`${apiBase}/api/auth/login-with-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: loginIdentifier, password }),
      });
      const raw = await res.text();
      let data: { token?: string; error?: string; suspensionReason?: string | null } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        setLocalError(
          isRTL
            ? `الخادم ردّ برد غير متوقع (${res.status})`
            : `Unexpected server response (${res.status})`,
        );
        return;
      }
      if (data.token) {
        try {
          await setAuthToken(data.token);
        } catch {
          setLocalError(
            isRTL
              ? "تم الدخول لكن تعذّر حفظ الجلسة على الجهاز"
              : "Signed in but session could not be saved on device",
          );
          return;
        }
        await clearSuspensionNotice();
        await refreshUser();
      } else if (data.error === "Invalid credentials") {
        setLocalError(
          isRTL
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
            : "Invalid email/mobile or password",
        );
      } else if (data.error === "Account is suspended") {
        const reason = typeof data.suspensionReason === "string" ? data.suspensionReason.trim() : "";
        if (reason) await saveSuspensionNotice(reason);
        setLocalError(
          reason
            ? (isRTL
              ? `هذا الحساب موقوف.\n\nالسبب: ${reason}`
              : `Your account has been suspended.\n\nReason: ${reason}`)
            : (isRTL
              ? "هذا الحساب موقوف. يرجى التواصل مع الدعم."
              : "Your account has been suspended. Please contact support."),
        );
      } else {
        setLocalError(
          data.error ||
            (isRTL ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again"),
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
        onBack={() => {
          setIdentifier("");
          setPassword("");
          setShowPassword(false);
          setLocalError("");
          router.replace("/welcome");
        }}
        showLangToggle
      />

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
            {t("app.name")}
          </Text>
          <Text
            style={[
              styles.tagline,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {t("app.tagline")}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          <Text
            style={[
              styles.cardTitle,
              {
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
                textAlign: isRTL ? "right" : "left",
              },
            ]}
          >
            {isRTL ? "تسجيل الدخول" : "Sign in"}
          </Text>
          <Text
            style={[
              styles.cardDesc,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                textAlign: isRTL ? "right" : "left",
              },
            ]}
          >
            {isRTL
              ? "ادخل بالبريد أو رقم الهاتف وكلمة المرور"
              : "Sign in with email or mobile and your password"}
          </Text>

          <FanniInput
            label={t("forgot.identifier")}
            value={identifier}
            onChangeText={(v) => {
              setIdentifier(v);
              setLocalError("");
            }}
            placeholder={
              isRTL ? "example@email.com أو 01XXXXXXXXX" : "example@email.com or 01XXXXXXXXX"
            }
            keyboardType="email-address"
            autoCapitalize="none"
            testID="login-identifier"
          />

          <View style={{ position: "relative" }}>
            <FanniInput
              label={t("login.password")}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setLocalError("");
              }}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              testID="login-password"
            />
            <TouchableOpacity
              style={[
                styles.eyeBtn,
                { right: isRTL ? undefined : 12, left: isRTL ? 12 : undefined },
              ]}
              onPress={() => setShowPassword(!showPassword)}
            >
              <VectorIcon
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>

          {!!localError && (
            <Text
              style={[
                styles.error,
                { color: colors.destructive, textAlign: isRTL ? "right" : "left" },
              ]}
            >
              {localError}
            </Text>
          )}

          <FanniButton
            title={t("login.submit")}
            onPress={handleLocalLogin}
            loading={localLoading}
            fullWidth
            testID="login-submit"
          />

          <TouchableOpacity
            onPress={() => router.push("/forgot-password")}
            style={styles.forgotBtn}
          >
            <Text
              style={[styles.forgotText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}
            >
              {t("login.forgot")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.registerHint, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text
            style={[
              styles.registerHintText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {t("login.noAccount")}{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text
              style={[
                styles.registerHintLink,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {t("login.register")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.ownership, { color: colors.mutedForeground, textAlign: "center" }]}>
          {isRTL ? APP_IDENTITY.companyLegalAr : APP_IDENTITY.companyLegalEn}
          {"\n"}
          {isRTL ? APP_IDENTITY.copyrightAr : APP_IDENTITY.copyrightEn}
          {"\n"}
          {t("about.version")}: {getAppVersionLabel()}
          {"\n"}
          {APP_IDENTITY.website.replace(/^https:\/\//, "")} · {APP_IDENTITY.supportEmail}
        </Text>
      </KeyboardAwareScrollViewCompat>
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
  forgotBtn: { alignItems: "center", paddingVertical: 4 },
  forgotText: { fontSize: 14 },
  eyeBtn: { position: "absolute", bottom: 18, zIndex: 1 },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -4 },
  registerHint: { justifyContent: "center", alignItems: "center", paddingVertical: 4 },
  registerHintText: { fontSize: 14 },
  registerHintLink: { fontSize: 14 },
  ownership: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 8,
    paddingHorizontal: 12,
  },
});
