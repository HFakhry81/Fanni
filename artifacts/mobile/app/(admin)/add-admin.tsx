import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform, TextInput, TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";
import PasswordStrengthBar, { getPasswordStrength } from "@/components/PasswordStrengthBar";
import Toast from "@/components/Toast";

const AUTH_TOKEN_KEY = "fanni_auth_token";
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddAdminScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isRTL } = useApp();
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    mobile?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // OTP state
  const [otpMode, setOtpMode] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [verificationToken, setVerificationToken] = useState("");
  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    fetch(`${getApiBase()}/api/config`)
      .then((r) => r.json())
      .then((d: { otpEnabled?: boolean }) => { if (d.otpEnabled) setOtpRequired(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const id = setInterval(() => setOtpCountdown((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; }), 1000);
    return () => clearInterval(id);
  }, [otpCountdown]);

  const normalizedMobile = useCallback((): string => {
    const d = mobile.trim().replace(/\s|-/g, "");
    const m = d.match(EGYPT_MOBILE_RE);
    return m ? `0${m[2]}` : d;
  }, [mobile]);

  const sendOtp = useCallback(async () => {
    setOtpSending(true);
    setOtpError("");
    try {
      const res = await fetch(`${getApiBase()}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: normalizedMobile() }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        setOtpError(data.error ?? (isRTL ? "تعذّر إرسال الرمز" : "Failed to send code"));
      } else {
        setOtpCountdown(RESEND_COOLDOWN);
      }
    } catch {
      setOtpError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setOtpSending(false);
    }
  }, [normalizedMobile, isRTL]);

  const handleOtpDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean && !value) {
      const d = [...otpDigits]; d[index] = "";
      setOtpDigits(d);
      if (index > 0) otpInputRefs.current[index - 1]?.focus();
      return;
    }
    if (clean.length > 1) {
      const pasted = clean.slice(0, OTP_LENGTH);
      const d = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i++) d[i] = pasted[i];
      setOtpDigits(d);
      otpInputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    if (clean) {
      const d = [...otpDigits]; d[index] = clean;
      setOtpDigits(d);
      if (index < OTP_LENGTH - 1) otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !otpDigits[index] && index > 0) {
      const d = [...otpDigits]; d[index - 1] = "";
      setOtpDigits(d);
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpVerify = async () => {
    const code = otpDigits.join("");
    if (code.length < OTP_LENGTH) {
      setOtpError(isRTL ? "يرجى إدخال الرمز المكون من 6 أرقام" : "Please enter the 6-digit code");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch(`${getApiBase()}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: normalizedMobile(), code }),
      });
      const data = await res.json() as { verificationToken?: string; error?: string };
      if (!res.ok || !data.verificationToken) {
        setOtpError(data.error ?? (isRTL ? "الرمز غير صحيح أو منتهي الصلاحية" : "Invalid or expired code"));
        return;
      }
      setVerificationToken(data.verificationToken);
      setOtpMode(false);
      await doCreateAdmin(data.verificationToken);
    } catch {
      setOtpError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setOtpLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace("/(admin)/dashboard");
    }
  }, [isLoading, user]);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!name.trim()) {
      newErrors.name = isRTL ? "الاسم مطلوب" : "Name is required";
    }
    if (!email.trim()) {
      newErrors.email = isRTL ? "البريد الإلكتروني مطلوب" : "Email is required";
    } else if (!EMAIL_RE.test(email.trim())) {
      newErrors.email = isRTL ? "بريد إلكتروني غير صحيح" : "Invalid email format";
    }
    const mobileDigits = mobile.trim().replace(/\s|-/g, "");
    if (!mobileDigits) {
      newErrors.mobile = isRTL ? "رقم الهاتف مطلوب" : "Mobile number is required";
    } else if (!mobileDigits.match(EGYPT_MOBILE_RE)) {
      newErrors.mobile = isRTL ? "صيغة غير صحيحة — مثال: 01XXXXXXXXX" : "Invalid format — e.g. 01XXXXXXXXX";
    }
    if (!password) {
      newErrors.password = isRTL ? "كلمة المرور مطلوبة" : "Password is required";
    } else if (!getPasswordStrength(password, isRTL).isStrong) {
      newErrors.password = isRTL ? "كلمة المرور ضعيفة — يرجى استيفاء جميع المتطلبات" : "Password is too weak — please meet all requirements";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = isRTL ? "تأكيد كلمة المرور مطلوب" : "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const doCreateAdmin = async (token?: string) => {
    setApiError("");
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const authToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      const res = await fetch(`${apiBase}/api/admin/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: normalizedMobile(),
          password,
          verificationToken: token || verificationToken || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = isRTL ? "تم إنشاء المسئول بنجاح" : "Admin created successfully";
        setToastMsg(msg);
        setShowToast(true);
      } else {
        const msg = data.error ?? "Unknown error";
        if (msg.includes("Mobile number is already registered")) {
          setApiError(isRTL ? "رقم الهاتف مسجل بالفعل" : "Mobile number is already registered");
        } else if (msg.includes("Email address is already registered")) {
          setApiError(isRTL ? "البريد الإلكتروني مسجل بالفعل" : "Email address is already registered");
        } else if (msg.includes("verification")) {
          setApiError(isRTL ? "التحقق من رقم الهاتف مطلوب" : "Phone verification is required");
        } else {
          setApiError(isRTL ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again");
        }
      }
    } catch {
      setApiError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setOtpError("");
    setOtpMode(true);
    await sendOtp();
  };

  if (isLoading || !user || user.role !== "admin") {
    return null;
  }

  const maskedMobile = normalizedMobile().replace(/^(0\d{2})(\d+)(\d{2})$/, "$1****$3");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "إضافة مسئول جديد" : "Add New Admin"}
        showBack
        onBack={() => { if (otpMode) setOtpMode(false); else router.back(); }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {otpMode ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
            <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
                <VectorIcon name="smartphone" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "التحقق من رقم الهاتف" : "Phone Verification"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? `أُرسل رمز إلى ${maskedMobile}` : `Code sent to ${maskedMobile}`}
                </Text>
              </View>
            </View>

            <View style={[styles.otpRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { otpInputRefs.current[i] = r; }}
                  style={[
                    styles.digitBox,
                    {
                      borderColor: otpDigits[i] ? colors.primary : colors.border,
                      backgroundColor: otpDigits[i] ? colors.accent : colors.card,
                      color: colors.foreground,
                    },
                  ]}
                  value={otpDigits[i]}
                  onChangeText={(v) => handleOtpDigitChange(i, v)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(i, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  textAlign="center"
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={handleOtpVerify}
                />
              ))}
            </View>

            {!!otpError && (
              <View style={[styles.otpErrorBox, { backgroundColor: "#FEE2E2", borderColor: "#F87171" }]}>
                <VectorIcon name="alert-circle" size={14} color="#DC2626" />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#DC2626", textAlign: isRTL ? "right" : "left" }}>{otpError}</Text>
              </View>
            )}

            <FanniButton
              title={otpLoading ? (isRTL ? "جاري التحقق..." : "Verifying...") : (isRTL ? "تحقق" : "Verify")}
              onPress={handleOtpVerify}
              disabled={otpLoading || otpDigits.join("").length < OTP_LENGTH}
              style={{ marginTop: 20 }}
            />

            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                {isRTL ? "لم تستلم الرمز؟" : "Didn't receive the code?"}
              </Text>
              {otpCountdown > 0 ? (
                <Text style={{ color: colors.secondary, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                  {isRTL ? `إعادة إرسال بعد ${otpCountdown}ث` : `Resend in ${otpCountdown}s`}
                </Text>
              ) : (
                <TouchableOpacity onPress={sendOtp} disabled={otpSending}>
                  <Text style={{ color: otpSending ? colors.mutedForeground : colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                    {otpSending ? (isRTL ? "جاري الإرسال..." : "Sending...") : (isRTL ? "إعادة إرسال" : "Resend")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {!otpRequired && (
              <TouchableOpacity
                style={{ marginTop: 20, alignItems: "center", padding: 10 }}
                onPress={() => { setOtpMode(false); doCreateAdmin(undefined); }}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" }}>
                  {isRTL ? "تخطي التحقق (وضع التطوير)" : "Skip verification (dev mode)"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
            <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
                <VectorIcon name="user-plus" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "بيانات المسئول الجديد" : "New Admin Details"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "سيتمكن المسئول من الدخول بالموبايل وكلمة المرور" : "Admin can log in with mobile number and password"}
                </Text>
              </View>
            </View>

            <FanniInput
              label={isRTL ? "الاسم الكامل" : "Full Name"}
              value={name}
              onChangeText={(v) => { setName(v); if (v.trim()) setErrors((e) => ({ ...e, name: undefined })); }}
              required
              placeholder={isRTL ? "مثال: محمد أحمد إبراهيم" : "e.g. Mohamed Ahmed Ibrahim"}
              error={errors.name}
            />
            <FanniInput
              label={isRTL ? "البريد الإلكتروني" : "Email"}
              value={email}
              onChangeText={(v) => { setEmail(v); if (v.trim()) setErrors((e) => ({ ...e, email: undefined })); }}
              keyboardType="email-address"
              required
              placeholder="admin@example.com"
              error={errors.email}
            />
            <FanniInput
              label={isRTL ? "رقم الهاتف" : "Mobile Number"}
              value={mobile}
              onChangeText={(v) => { setMobile(v); setErrors((e) => ({ ...e, mobile: undefined })); }}
              keyboardType="phone-pad"
              required
              placeholder="01XXXXXXXXX"
              error={errors.mobile}
            />
            <FanniInput
              label={isRTL ? "كلمة المرور" : "Password"}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
              secureTextEntry
              required
              placeholder={isRTL ? "أدخل كلمة مرور قوية" : "Enter a strong password"}
              error={errors.password}
            />
            {!!password && <PasswordStrengthBar password={password} />}
            <FanniInput
              label={isRTL ? "تأكيد كلمة المرور" : "Confirm Password"}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: undefined })); }}
              secureTextEntry
              required
              placeholder={isRTL ? "أعد إدخال كلمة المرور" : "Re-enter your password"}
              error={errors.confirmPassword}
            />
          </View>
        )}

        {!!apiError && !otpMode && (
          <View style={[styles.msgBox, { backgroundColor: "#FEE2E2", borderColor: "#EF4444", borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <VectorIcon name="alert-circle" size={14} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0, textAlign: isRTL ? "right" : "left" }}>
              {apiError}
            </Text>
          </View>
        )}

        {!otpMode && (
          <FanniButton
            title={isRTL ? "إنشاء المسئول" : "Create Admin"}
            onPress={handleSubmit}
            loading={loading}
            disabled={password.length > 0 && !getPasswordStrength(password, isRTL).isStrong}
          />
        )}
      </ScrollView>

      <Toast
        visible={showToast}
        message={toastMsg}
        duration={2000}
        onHide={() => {
          setShowToast(false);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  card: {
    padding: 20,
    marginBottom: 16,
    shadowColor: "#0D1B2A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { alignItems: "center", marginBottom: 20 },
  headerIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  msgBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, padding: 12, marginBottom: 12 },
  otpRow: { gap: 10, justifyContent: "center", marginBottom: 8 },
  digitBox: { flex: 1, aspectRatio: 1, maxWidth: 50, borderWidth: 2, borderRadius: 12, fontSize: 22, fontFamily: "Inter_700Bold" },
  otpErrorBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 12 },
});
