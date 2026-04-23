import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

const RESEND_COOLDOWN = 60;
const OTP_LENGTH = 6;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { mobile, nextRoute } = useLocalSearchParams<{ mobile: string; nextRoute: string }>();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const sendOtp = useCallback(async () => {
    if (!mobile) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${getApiBase()}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? (isRTL ? "تعذّر إرسال الرمز" : "Failed to send code"));
      } else {
        startCountdown();
      }
    } catch {
      setError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setSending(false);
    }
  }, [mobile, isRTL, startCountdown]);

  useEffect(() => {
    sendOtp();
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean && !value) {
      const newDigits = [...digits];
      newDigits[index] = "";
      setDigits(newDigits);
      if (index > 0) inputRefs.current[index - 1]?.focus();
      return;
    }
    if (clean.length > 1) {
      const pasted = clean.slice(0, OTP_LENGTH);
      const newDigits = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
      setDigits(newDigits);
      const nextIndex = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }
    if (clean) {
      const newDigits = [...digits];
      newDigits[index] = clean;
      setDigits(newDigits);
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const code = digits.join("");

  const handleVerify = async () => {
    if (code.length < OTP_LENGTH) {
      setError(isRTL ? "يرجى إدخال الرمز المكون من 6 أرقام" : "Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${getApiBase()}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code }),
      });
      const data = await res.json() as { verificationToken?: string; error?: string };
      if (!res.ok || !data.verificationToken) {
        setError(data.error ?? (isRTL ? "الرمز غير صحيح أو منتهي الصلاحية" : "Invalid or expired code"));
        return;
      }
      router.replace({
        pathname: nextRoute as any ?? "/register",
        params: { verificationToken: data.verificationToken, verifiedMobile: mobile },
      });
    } catch {
      setError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const maskedMobile = mobile
    ? mobile.replace(/^(0\d{2})(\d+)(\d{2})$/, "$1****$3")
    : "";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("otp.title")} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.iconBox, { backgroundColor: colors.accent }]}>
            <Feather name="smartphone" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.heading, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {t("otp.heading")}
          </Text>
          <Text style={[styles.subtext, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("otp.sent")} {maskedMobile}
          </Text>

          <View style={[styles.otpRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {Array.from({ length: OTP_LENGTH }, (_, i) => (
              <TextInput
                key={i}
                ref={(r) => { inputRefs.current[i] = r; }}
                style={[
                  styles.digitBox,
                  {
                    borderColor: digits[i] ? colors.primary : colors.border,
                    backgroundColor: digits[i] ? colors.accent : colors.card,
                    color: colors.foreground,
                  },
                ]}
                value={digits[i]}
                onChangeText={(v) => handleDigitChange(i, v)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                textAlign="center"
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />
            ))}
          </View>

          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#F87171" }]}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{error}</Text>
            </View>
          )}

          <FanniButton
            title={loading ? (isRTL ? "جاري التحقق..." : "Verifying...") : t("otp.verify")}
            onPress={handleVerify}
            disabled={loading || code.length < OTP_LENGTH}
            style={{ marginTop: 24 }}
          />

          <View style={[styles.resendRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={[styles.resendLabel, { color: colors.mutedForeground }]}>
              {t("otp.noCode")}
            </Text>
            {countdown > 0 ? (
              <Text style={[styles.countdown, { color: colors.secondary }]}>
                {isRTL ? `إعادة إرسال بعد ${countdown}ث` : `Resend in ${countdown}s`}
              </Text>
            ) : (
              <TouchableOpacity onPress={sendOtp} disabled={sending}>
                <Text style={[styles.resendBtn, { color: sending ? colors.mutedForeground : colors.primary }]}>
                  {sending ? (isRTL ? "جاري الإرسال..." : "Sending...") : t("otp.resend")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
    lineHeight: 20,
  },
  otpRow: {
    gap: 10,
    justifyContent: "center",
    marginBottom: 8,
  },
  digitBox: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#DC2626",
  },
  resendRow: {
    marginTop: 20,
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  resendLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  resendBtn: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  countdown: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
