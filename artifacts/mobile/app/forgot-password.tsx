import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";

type Step = "request" | "reset" | "success";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `http://${domain}` : "";
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("request");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleRequestCode = async () => {
    if (!identifier.trim()) {
      setError(isRTL ? "يرجى إدخال البريد الإلكتروني أو رقم الهاتف" : "Please enter your email or mobile number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("reset");
      } else if (res.status === 429) {
        setError(isRTL ? "طلبات كثيرة جدًا. يرجى الانتظار قبل المحاولة مرة أخرى." : "Too many requests. Please wait before trying again.");
      } else {
        setError(data.error ?? (isRTL ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again"));
      }
    } catch {
      setError(isRTL ? "تعذر الاتصال بالخادم" : "Could not reach server");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (!code.trim() || code.trim().length !== 6) {
      setError(t("forgot.invalidCode"));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("forgot.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("forgot.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("success");
      } else {
        setError(data.error === "Invalid or expired code"
          ? t("forgot.invalidCode")
          : (isRTL ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again"));
      }
    } catch {
      setError(isRTL ? "تعذر الاتصال بالخادم" : "Could not reach server");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("forgot.title")} showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <View style={[styles.successIcon, { backgroundColor: colors.accent }]}>
            <VectorIcon name="check-circle" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
            {t("forgot.success")}
          </Text>
          <Text style={[styles.successDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            {t("forgot.successDesc")}
          </Text>
          <FanniButton
            title={t("forgot.backToLogin")}
            onPress={() => router.replace("/login")}
            fullWidth
            style={{ marginTop: 24 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("forgot.title")} showBack onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.stepIndicator, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {(["request", "reset"] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <View style={[
                styles.stepDot,
                { backgroundColor: step === s || (s === "request" && step === "reset") ? colors.primary : colors.border },
              ]}>
                {s === "request" && step === "reset" ? (
                  <VectorIcon name="check" size={12} color="#FFF" />
                ) : (
                  <Text style={{ color: "#FFF", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{i + 1}</Text>
                )}
              </View>
              {i < 1 && <View style={[styles.stepLine, { backgroundColor: step === "reset" ? colors.primary : colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          {step === "request" ? (
            <>
              <View style={[styles.iconRow, { alignSelf: isRTL ? "flex-end" : "flex-start" }]}>
                <View style={[styles.iconBg, { backgroundColor: colors.accent }]}>
                  <VectorIcon name="mail" size={22} color={colors.primary} />
                </View>
              </View>
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                {t("forgot.title")}
              </Text>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }]}>
                {t("forgot.subtitle")}
              </Text>

              <FanniInput
                label={t("forgot.identifier")}
                value={identifier}
                onChangeText={(v) => { setIdentifier(v); setError(""); }}
                placeholder={isRTL ? "example@email.com أو 01XXXXXXXXX" : "example@email.com or 01XXXXXXXXX"}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {!!error && (
                <Text style={[styles.error, { color: colors.destructive, textAlign: isRTL ? "right" : "left" }]}>
                  {error}
                </Text>
              )}

              <FanniButton
                title={t("forgot.send")}
                onPress={handleRequestCode}
                loading={loading}
                fullWidth
                style={{ marginTop: 8 }}
              />
            </>
          ) : (
            <>
              <View style={[styles.sentBadge, { backgroundColor: colors.accent, borderColor: colors.primary, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <VectorIcon name="send" size={16} color={colors.primary} />
                <View style={{ marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0, flex: 1 }}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                    {t("forgot.sent")}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                    {t("forgot.sentDesc")}
                  </Text>
                </View>
              </View>

              <FanniInput
                label={t("forgot.code")}
                value={code}
                onChangeText={(v) => { setCode(v.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                placeholder={t("forgot.codePlaceholder")}
                keyboardType="numeric"
                maxLength={6}
              />

              <View style={{ position: "relative" }}>
                <FanniInput
                  label={t("forgot.newPassword")}
                  value={newPassword}
                  onChangeText={(v) => { setNewPassword(v); setError(""); }}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={[styles.eyeBtn, { right: isRTL ? undefined : 12, left: isRTL ? 12 : undefined }]}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <VectorIcon name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={{ position: "relative" }}>
                <FanniInput
                  label={t("forgot.confirmPassword")}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setError(""); }}
                  placeholder="••••••••"
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity
                  style={[styles.eyeBtn, { right: isRTL ? undefined : 12, left: isRTL ? 12 : undefined }]}
                  onPress={() => setShowConfirm(!showConfirm)}
                >
                  <VectorIcon name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {!!error && (
                <Text style={[styles.error, { color: colors.destructive, textAlign: isRTL ? "right" : "left" }]}>
                  {error}
                </Text>
              )}

              <FanniButton
                title={t("forgot.resetBtn")}
                onPress={handleResetPassword}
                loading={loading}
                fullWidth
                style={{ marginTop: 8 }}
              />

              <TouchableOpacity style={styles.resendBtn} onPress={() => setStep("request")}>
                <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" }}>
                  {isRTL ? "لم تستلم الرمز؟ إعادة الإرسال" : "Didn't receive the code? Resend"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  stepIndicator: { alignItems: "center", justifyContent: "center", marginBottom: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepLine: { flex: 1, height: 2, maxWidth: 80 },
  card: {
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  iconRow: { marginBottom: 4 },
  iconBg: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 20 },
  cardDesc: { fontSize: 14, lineHeight: 21 },
  sentBadge: { padding: 12, borderWidth: 1.5, borderRadius: 10, alignItems: "center" },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -4 },
  eyeBtn: { position: "absolute", bottom: 18, zIndex: 1 },
  resendBtn: { paddingVertical: 4, marginTop: 4 },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  successTitle: { fontSize: 22, marginBottom: 12 },
  successDesc: { fontSize: 15, lineHeight: 22 },
});
