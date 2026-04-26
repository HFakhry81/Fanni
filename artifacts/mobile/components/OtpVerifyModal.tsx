import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import VectorIcon from "@/components/VectorIcon";
import FanniButton from "@/components/FanniButton";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

interface Props {
  visible: boolean;
  mobile: string;
  onCancel: () => void;
  onVerified: (token: string, expiresAt: number) => void;
  subtitle?: string;
}

export default function OtpVerifyModal({ visible, mobile, onCancel, onVerified, subtitle }: Props) {
  const colors = useColors();
  const { isRTL } = useApp();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const normalizeMobile = (m: string) => {
    const digits = m.trim().replace(/\s|-/g, "");
    const match = digits.match(/^(\+?20|0)(1[0125][0-9]{8})$/);
    return match ? `0${match[2]}` : digits;
  };

  useEffect(() => {
    if (visible) {
      setDigits(Array(OTP_LENGTH).fill(""));
      setError("");
      setLoading(false);
      sendOtp();
    }
  }, [visible]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOtp = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${getApiBase()}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: normalizeMobile(mobile) }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? (isRTL ? "تعذّر إرسال الرمز" : "Failed to send code"));
      } else {
        setCountdown(RESEND_COOLDOWN);
      }
    } catch {
      setError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setSending(false);
    }
  }, [mobile, isRTL, sending]);

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean && !value) {
      const d = [...digits]; d[index] = "";
      setDigits(d);
      if (index > 0) inputRefs.current[index - 1]?.focus();
      return;
    }
    if (clean.length > 1) {
      const pasted = clean.slice(0, OTP_LENGTH);
      const d = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i++) d[i] = pasted[i]!;
      setDigits(d);
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    if (clean) {
      const d = [...digits]; d[index] = clean;
      setDigits(d);
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      const d = [...digits]; d[index - 1] = "";
      setDigits(d);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join("");
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
        body: JSON.stringify({ mobile: normalizeMobile(mobile), code }),
      });
      const data = await res.json() as { verificationToken?: string; error?: string };
      if (!res.ok || !data.verificationToken) {
        setError(data.error ?? (isRTL ? "الرمز غير صحيح أو منتهي الصلاحية" : "Invalid or expired code"));
        return;
      }
      onVerified(data.verificationToken, Date.now() + 30 * 60 * 1000);
    } catch {
      setError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const maskedMobile = normalizeMobile(mobile).replace(/^(0\d{2})(\d+)(\d{2})$/, "$1****$3");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}>
                <VectorIcon name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, flex: 1, textAlign: "center" }}>
                {isRTL ? "تحقق من رقم الهاتف" : "Verify Phone Number"}
              </Text>
              <View style={{ width: 30 }} />
            </View>

            <View style={{ padding: 20 }}>
              {!!subtitle && (
                <View style={[styles.subtitleBox, { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }]}>
                  <VectorIcon name="alert-triangle" size={14} color="#D97706" />
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#92400E", textAlign: isRTL ? "right" : "left" }}>
                    {subtitle}
                  </Text>
                </View>
              )}
              <View style={[styles.iconRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
                  <VectorIcon name="smartphone" size={20} color={colors.primary} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? `تم إرسال رمز التحقق إلى` : "A verification code was sent to"}{" "}
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{maskedMobile}</Text>
                </Text>
              </View>

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
                  <VectorIcon name="alert-circle" size={14} color="#DC2626" />
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626", textAlign: isRTL ? "right" : "left" }}>{error}</Text>
                </View>
              )}

              {sending && (
                <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                    {isRTL ? "جاري إرسال الرمز..." : "Sending code..."}
                  </Text>
                </View>
              )}

              <FanniButton
                title={loading ? (isRTL ? "جاري التحقق..." : "Verifying...") : (isRTL ? "تحقق" : "Verify")}
                onPress={handleVerify}
                disabled={loading || digits.join("").length < OTP_LENGTH}
                style={{ marginTop: 20 }}
              />

              <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                  {isRTL ? "لم تستلم الرمز؟" : "Didn't receive the code?"}
                </Text>
                {countdown > 0 ? (
                  <Text style={{ color: colors.secondary, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                    {isRTL ? `إعادة إرسال بعد ${countdown}ث` : `Resend in ${countdown}s`}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={sendOtp} disabled={sending}>
                    <Text style={{ color: sending ? colors.mutedForeground : colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                      {sending ? (isRTL ? "جاري الإرسال..." : "Sending...") : (isRTL ? "إعادة إرسال" : "Resend")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 },
  header: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconRow: { alignItems: "center", gap: 10, marginBottom: 24 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  otpRow: { gap: 10, justifyContent: "center", marginBottom: 8 },
  digitBox: { width: 44, height: 52, borderRadius: 10, borderWidth: 1.5, fontSize: 22, fontFamily: "Inter_700Bold" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 12 },
  subtitleBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 16 },
});
