import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";
import PasswordStrengthBar, { getPasswordStrength } from "@/components/PasswordStrengthBar";
import Toast from "@/components/Toast";

const AUTH_TOKEN_KEY = "fanni_auth_token";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

export default function AddAdminScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isRTL } = useApp();
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

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = isRTL ? "الاسم مطلوب" : "Name is required";
    }

    if (!email.trim()) {
      newErrors.email = isRTL ? "البريد الإلكتروني مطلوب" : "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
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

  const handleSubmit = async () => {
    if (!validate()) return;

    const mobileDigits = mobile.trim().replace(/\s|-/g, "");
    const mobileMatch = mobileDigits.match(EGYPT_MOBILE_RE);
    const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : mobileDigits;

    setApiError("");
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      const res = await fetch(`${apiBase}/api/admin/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: normalizedMobile,
          password,
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "إضافة مسئول جديد" : "Add New Admin"}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          {/* Header */}
          <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
              <Feather name="user-plus" size={22} color={colors.primary} />
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
            onChangeText={(v) => { setPassword(v); if (v) setErrors((e) => ({ ...e, password: undefined })); }}
            secureTextEntry
            required
            placeholder={isRTL ? "أدخل كلمة مرور قوية" : "Enter a strong password"}
            error={errors.password}
          />
          {!!password && <PasswordStrengthBar password={password} />}

          <FanniInput
            label={isRTL ? "تأكيد كلمة المرور" : "Confirm Password"}
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); if (v) setErrors((e) => ({ ...e, confirmPassword: undefined })); }}
            secureTextEntry
            required
            placeholder={isRTL ? "أعد إدخال كلمة المرور" : "Re-enter your password"}
            error={errors.confirmPassword}
          />
        </View>

        {!!apiError && (
          <View style={[styles.msgBox, { backgroundColor: "#FEE2E2", borderColor: "#EF4444", borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0, textAlign: isRTL ? "right" : "left" }}>
              {apiError}
            </Text>
          </View>
        )}

        <FanniButton
          title={isRTL ? "إنشاء المسئول" : "Create Admin"}
          onPress={handleSubmit}
          loading={loading}
        />
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
});
