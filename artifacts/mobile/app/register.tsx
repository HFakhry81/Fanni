import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform, TextInput, Modal,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import LocationPicker from "@/components/LocationPicker";
import AppHeader from "@/components/AppHeader";
import PasswordStrengthBar, { getPasswordStrength } from "@/components/PasswordStrengthBar";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

const AUTH_TOKEN_KEY = "fanni_auth_token";

interface ApiDomain { id: string; nameEn: string; nameAr: string; icon: string | null; }
interface ApiSpec { id: string; domainId: string; nameEn: string; nameAr: string; }

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

function timeStringToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(isNaN(h) ? 8 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

type RegisterType = "client" | "technician";
type PaymentMethod = "bank" | "ewallet" | "instapay";

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [regType, setRegType] = useState<RegisterType>("client");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Personal Info ──────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ── Payment ────────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");
  const [bankAccount, setBankAccount] = useState("");

  // ── Technician Info ────────────────────────────────────────────────────────
  const [profession, setProfession] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [experience, setExperience] = useState("");

  // ── Location (shared) ──────────────────────────────────────────────────────
  const [governorateId, setGovernorateId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");

  // ── Technician service hours ───────────────────────────────────────────────
  const [serviceStart, setServiceStart] = useState("08:00");
  const [serviceEnd, setServiceEnd] = useState("22:00");
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);

  // ── OTP verification state ─────────────────────────────────────────────────
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
    // Fetch backend config to know if OTP is mandatory
    fetch(`${getApiBase()}/api/config`)
      .then((r) => r.json())
      .then((d: { otpEnabled?: boolean }) => { if (d.otpEnabled) setOtpRequired(true); })
      .catch(() => { /* ignore — default false means non-blocking */ });
  }, []);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const id = setInterval(() => setOtpCountdown((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; }), 1000);
    return () => clearInterval(id);
  }, [otpCountdown]);

  const normalizedMobile = useCallback((): string => {
    const mobileDigits = mobile.trim().replace(/\s|-/g, "");
    const m = mobileDigits.match(EGYPT_MOBILE_RE);
    return m ? `0${m[2]}` : mobileDigits;
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
      setStep(2);
    } catch {
      setOtpError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setOtpLoading(false);
    }
  };

  // ── API-fetched domains & specializations ──────────────────────────────────
  const [apiDomains, setApiDomains] = useState<ApiDomain[]>([]);
  const [apiSpecs, setApiSpecs] = useState<ApiSpec[]>([]);
  const [domainPickerVisible, setDomainPickerVisible] = useState(false);
  const [specPickerVisible, setSpecPickerVisible] = useState(false);

  useEffect(() => {
    fetch(`${getApiBase()}/api/categories/domains`)
      .then((r) => r.json())
      .then((d: { domains?: ApiDomain[] }) => { if (d.domains) setApiDomains(d.domains); })
      .catch(() => {});
  }, []);

  const loadSpecs = useCallback((domainId: string) => {
    fetch(`${getApiBase()}/api/categories/specializations?domainId=${domainId}`)
      .then((r) => r.json())
      .then((d: { specializations?: ApiSpec[] }) => { if (d.specializations) setApiSpecs(d.specializations); })
      .catch(() => {});
  }, []);

  // ── Technician service categories ─────────────────────────────────────────
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // ── Duplicate-field flags (for "Log in instead" prompt) ───────────────────
  const [mobileTaken, setMobileTaken] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);

  // ── API error ─────────────────────────────────────────────────────────────
  const [apiError, setApiError] = useState("");

  // ── Validation errors ──────────────────────────────────────────────────────
  const [errors, setErrors] = useState<{
    name?: string;
    mobile?: string;
    email?: string;
    nationalId?: string;
    area?: string;
    password?: string;
    confirmPassword?: string;
    profession?: string;
    specialty?: string;
    experience?: string;
    serviceStart?: string;
    serviceEnd?: string;
  }>({});

  const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;
  const totalSteps = regType === "technician" ? 4 : 3;

  const toggleCategory = (key: string) => {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    );
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: typeof errors = {};

    if (step === 1) {
      if (!name.trim()) {
        newErrors.name = isRTL ? "الاسم مطلوب" : "Name is required";
      }

      const mobileDigits = mobile.trim().replace(/\s|-/g, "");
      if (!mobileDigits) {
        newErrors.mobile = isRTL ? "رقم الهاتف مطلوب" : "Mobile number is required";
      } else if (!mobileDigits.match(EGYPT_MOBILE_RE)) {
        newErrors.mobile = isRTL ? "صيغة غير صحيحة — مثال: 01XXXXXXXXX" : "Invalid format — e.g. 01XXXXXXXXX";
      }

      if (regType === "technician" && !nationalId.trim()) {
        newErrors.nationalId = isRTL ? "الرقم القومي مطلوب" : "National ID is required";
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
    }

    if (step === 2 && regType === "technician") {
      if (!profession.trim()) {
        newErrors.profession = isRTL ? "المهنة مطلوبة" : "Profession is required";
      }
      if (!specialty.trim()) {
        newErrors.specialty = isRTL ? "التخصص مطلوب" : "Specialty is required";
      }
      const expNum = Number(experience.trim());
      if (!experience.trim()) {
        newErrors.experience = isRTL ? "سنوات الخبرة مطلوبة" : "Years of experience is required";
      } else if (isNaN(expNum) || expNum <= 0) {
        newErrors.experience = isRTL ? "يجب أن تكون الخبرة عدداً موجباً" : "Experience must be a positive number";
      }

      const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
      const startValid = TIME_RE.test(serviceStart.trim());
      const endValid = TIME_RE.test(serviceEnd.trim());

      if (!startValid) {
        newErrors.serviceStart = isRTL ? "صيغة غير صحيحة — مثال: 08:00" : "Invalid format — e.g. 08:00";
      }
      if (!endValid) {
        newErrors.serviceEnd = isRTL ? "صيغة غير صحيحة — مثال: 22:00" : "Invalid format — e.g. 22:00";
      }
      if (startValid && endValid) {
        const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        if (toMinutes(serviceEnd.trim()) <= toMinutes(serviceStart.trim())) {
          newErrors.serviceEnd = isRTL ? "وقت الانتهاء يجب أن يكون بعد وقت البدء" : "Work End must be later than Work Start";
        }
      }
    }

    if (step === totalSteps) {
      if (!governorateId) {
        newErrors.area = isRTL ? "يرجى اختيار المحافظة" : "Please select a governorate";
      } else if (!areaId) {
        newErrors.area = isRTL ? "يرجى اختيار المنطقة" : "Please select an area";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;

    if (step === 1) {
      const nm = normalizedMobile();
      setLoading(true);
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/auth/check-availability`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mobile: nm,
            email: email.trim() || undefined,
          }),
        });
        const data = await res.json() as { mobileTaken?: boolean; emailTaken?: boolean };
        const availabilityErrors: typeof errors = {};
        if (data.mobileTaken) {
          availabilityErrors.mobile = isRTL ? "رقم الهاتف مسجل بالفعل" : "Mobile number is already registered";
          setMobileTaken(true);
        }
        if (data.emailTaken) {
          availabilityErrors.email = isRTL ? "البريد الإلكتروني مسجل بالفعل" : "Email address is already registered";
          setEmailTaken(true);
        }
        if (Object.keys(availabilityErrors).length > 0) {
          setErrors(availabilityErrors);
          return;
        }
        // Enter OTP verification mode
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        setOtpError("");
        setOtpMode(true);
        await sendOtp();
      } catch {
        setApiError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      setApiError("");
      setLoading(true);
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim() || undefined,
            mobile: normalizedMobile(),
            password,
            role: regType,
            nationalId: nationalId.trim() || undefined,
            governorateId: governorateId || undefined,
            areaId: areaId || undefined,
            verificationToken: verificationToken || undefined,
            profession: regType === "technician" && profession.trim() ? profession.trim() : undefined,
            specialty: regType === "technician" && specialty.trim() ? specialty.trim() : undefined,
            serviceCategories: regType === "technician" && selectedCategories.length > 0 ? selectedCategories : undefined,
          }),
        });
        const data = await res.json() as { token?: string; user?: { id: string }; error?: string };
        if (data.token) {
          await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
          await refreshUser();
          if (regType === "technician" && selectedCategories.length > 0) {
            try {
              const profileRes = await fetch(`${apiBase}/api/auth/user`, {
                headers: { Authorization: `Bearer ${data.token}` },
              });
              const profileData = await profileRes.json() as { user?: { serviceCategories?: string[] | null } };
              const savedCategories = profileData.user?.serviceCategories;
              if (!savedCategories || savedCategories.length === 0) {
                setApiError(isRTL ? "تعذّر حفظ تخصصاتك، يرجى تحديثها من ملفك الشخصي" : "Could not save your service categories. Please update them from your profile.");
                return;
              }
            } catch {
              setApiError(isRTL ? "تعذّر التحقق من حفظ تخصصاتك" : "Could not verify your service categories were saved.");
              return;
            }
          }
          router.replace({
            pathname: "/register-success",
            params: { name: name.trim(), role: regType },
          });
        } else {
          const msg = data.error ?? "Unknown error";
          if (msg.includes("Mobile number is already registered")) {
            setApiError(isRTL ? "رقم الهاتف مسجل بالفعل" : "Mobile number is already registered");
          } else if (msg.includes("Email address is already registered")) {
            setApiError(isRTL ? "البريد الإلكتروني مسجل بالفعل" : "Email address is already registered");
          } else if (msg.includes("Too many")) {
            setApiError(isRTL ? "محاولات كثيرة جداً، يرجى الانتظار" : "Too many attempts, please wait");
          } else {
            setApiError(isRTL ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again");
          }
        }
      } catch {
        setApiError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (otpMode) { setOtpMode(false); return; }
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  const paymentOptions = [
    { id: "bank"    as PaymentMethod, label: t("register.bankAccount"), icon: "credit-card" },
    { id: "ewallet" as PaymentMethod, label: t("register.eWallet"),     icon: "smartphone"  },
    { id: "instapay"as PaymentMethod, label: t("register.instaPay"),    icon: "zap"         },
  ];

  // ── Step indicator ─────────────────────────────────────────────────────────
  const renderStepIndicator = () => (
    <View style={[styles.stepRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
        <React.Fragment key={s}>
          <View
            style={[
              styles.stepCircle,
              { backgroundColor: s <= step ? colors.primary : colors.muted, borderColor: s <= step ? colors.primary : colors.border },
            ]}
          >
            {s < step ? (
              <VectorIcon name="check" size={14} color="#FFF" />
            ) : (
              <Text style={{ color: s <= step ? "#FFF" : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{s}</Text>
            )}
          </View>
          {s < totalSteps && (
            <View style={[styles.stepLine, { backgroundColor: s < step ? colors.primary : colors.border }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  // ── Step 1: Personal info ──────────────────────────────────────────────────
  const renderStep1 = () => (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accent }]}>
          <VectorIcon name="user" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left", flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
          {t("register.step1")}
        </Text>
      </View>

      <FanniInput
        label={t("register.name")}
        value={name}
        onChangeText={(v) => { setName(v); if (v.trim()) setErrors((e) => ({ ...e, name: undefined })); }}
        required
        placeholder={isRTL ? "الاسم رباعي كامل" : "Full name"}
        error={errors.name}
      />
      {regType === "technician" && (
        <FanniInput label={t("register.age")} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" />
      )}
      <FanniInput
        label={isRTL ? "رقم الهاتف" : "Mobile Number"}
        value={mobile}
        onChangeText={(v) => { setMobile(v); setMobileTaken(false); setErrors((e) => ({ ...e, mobile: undefined })); }}
        keyboardType="phone-pad" required
        placeholder="01XXXXXXXXX"
        error={errors.mobile}
      />
      {mobileTaken && (
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          style={[styles.loginPrompt, { flexDirection: isRTL ? "row-reverse" : "row" }]}
        >
          <Text style={[styles.loginPromptText, { color: colors.mutedForeground }]}>
            {isRTL ? "هل لديك حساب بالفعل؟ " : "Already have an account? "}
          </Text>
          <Text style={[styles.loginPromptLink, { color: colors.primary }]}>
            {isRTL ? "تسجيل الدخول" : "Log in instead"}
          </Text>
        </TouchableOpacity>
      )}
      <FanniInput
        label={t("register.email")}
        value={email}
        onChangeText={(v) => { setEmail(v); setEmailTaken(false); setErrors((e) => ({ ...e, email: undefined })); }}
        keyboardType="email-address"
        placeholder="email@example.com"
        error={errors.email}
      />
      {emailTaken && (
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          style={[styles.loginPrompt, { flexDirection: isRTL ? "row-reverse" : "row" }]}
        >
          <Text style={[styles.loginPromptText, { color: colors.mutedForeground }]}>
            {isRTL ? "هل لديك حساب بالفعل؟ " : "Already have an account? "}
          </Text>
          <Text style={[styles.loginPromptLink, { color: colors.primary }]}>
            {isRTL ? "تسجيل الدخول" : "Log in instead"}
          </Text>
        </TouchableOpacity>
      )}

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

      {regType === "technician" && (
        <FanniInput
          label={isRTL ? "الرقم القومي" : "National ID"}
          value={nationalId}
          onChangeText={(v) => { setNationalId(v); if (v.trim()) setErrors((e) => ({ ...e, nationalId: undefined })); }}
          keyboardType="numeric" required
          placeholder="2XXXXXXXXXXXXXXXXX"
          error={errors.nationalId}
        />
      )}

      {regType === "technician" && (
        <TouchableOpacity style={[styles.uploadBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted }]}>
          <VectorIcon name="camera" size={24} color={colors.secondary} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 8 }}>
            {t("register.idPhoto")}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3 }}>
            {isRTL ? "صورة واضحة من الوجهين" : "Clear photo of both sides"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Step 2 Client: Payment ─────────────────────────────────────────────────
  const renderStep2Client = () => (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accentBlue }]}>
          <VectorIcon name="credit-card" size={20} color={colors.secondary} />
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
          {t("register.step2")}
        </Text>
      </View>

      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
        {t("register.paymentMethod")}
      </Text>

      {paymentOptions.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={[
            styles.optionRow,
            {
              borderColor: paymentMethod === opt.id ? colors.primary : colors.border,
              backgroundColor: paymentMethod === opt.id ? colors.accent : colors.card,
              borderRadius: colors.radius,
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
          onPress={() => setPaymentMethod(opt.id)}
        >
          <View style={[styles.optionIcon, { backgroundColor: paymentMethod === opt.id ? colors.primary + "20" : colors.muted, borderRadius: 10 }]}>
            <VectorIcon name={opt.icon as any} size={18} color={paymentMethod === opt.id ? colors.primary : colors.mutedForeground} />
          </View>
          <Text style={{ color: colors.foreground, fontFamily: paymentMethod === opt.id ? "Inter_600SemiBold" : "Inter_500Medium", fontSize: 14, flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
            {opt.label}
          </Text>
          <View style={[styles.radio, { borderColor: paymentMethod === opt.id ? colors.primary : colors.border, backgroundColor: paymentMethod === opt.id ? colors.primary : "transparent" }]} />
        </TouchableOpacity>
      ))}

      {(paymentMethod === "bank" || paymentMethod === "ewallet") && (
        <FanniInput
          label={paymentMethod === "bank" ? (isRTL ? "رقم الحساب البنكي" : "Bank Account Number") : (isRTL ? "رقم المحفظة" : "E-Wallet Number")}
          value={bankAccount} onChangeText={setBankAccount}
          keyboardType="numeric"
          placeholder={paymentMethod === "bank" ? "XXXXXXXXXXXXXXXXXXXXXXX" : "01XXXXXXXXX"}
        />
      )}
    </View>
  );

  // ── Step 2 Tech: Profession info ───────────────────────────────────────────
  const renderStep2Tech = () => {
    const selectedDomain = apiDomains.find((d) => d.nameEn === profession || d.nameAr === profession);
    const availableSpecs = selectedDomain
      ? apiSpecs.filter((s) => s.domainId === selectedDomain.id)
      : apiSpecs;

    return (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accent }]}>
          <VectorIcon name="tool" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
          {isRTL ? "بيانات المهنة" : "Profession Info"}
        </Text>
      </View>

      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
        {t("register.profession")} <Text style={{ color: colors.destructive }}>*</Text>
      </Text>
      <TouchableOpacity
        onPress={() => { setDomainPickerVisible(true); }}
        style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: errors.profession ? colors.destructive : colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", marginBottom: errors.profession ? 4 : 14 }}
      >
        <Text style={{ color: profession ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
          {profession ? (isRTL ? (apiDomains.find((d) => d.nameEn === profession)?.nameAr ?? profession) : profession) : (isRTL ? "اختر المجال" : "Select domain")}
        </Text>
        <VectorIcon name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {errors.profession ? <Text style={{ color: colors.destructive, fontSize: 12, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>{errors.profession}</Text> : null}

      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
        {t("register.specialty")} <Text style={{ color: colors.destructive }}>*</Text>
      </Text>
      <TouchableOpacity
        onPress={() => {
          if (selectedDomain) loadSpecs(selectedDomain.id);
          setSpecPickerVisible(true);
        }}
        style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: errors.specialty ? colors.destructive : colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", marginBottom: errors.specialty ? 4 : 14 }}
      >
        <Text style={{ color: specialty ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
          {specialty ? (isRTL ? (apiSpecs.find((s) => s.nameEn === specialty)?.nameAr ?? specialty) : specialty) : (isRTL ? "اختر التخصص" : "Select specialization")}
        </Text>
        <VectorIcon name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {errors.specialty ? <Text style={{ color: colors.destructive, fontSize: 12, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>{errors.specialty}</Text> : null}

      {/* Domain picker modal */}
      <Modal visible={domainPickerVisible} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setDomainPickerVisible(false)} />
        <View style={{ backgroundColor: colors.card, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "60%" }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "اختر المجال" : "Select Domain"}
          </Text>
          <ScrollView>
            {(apiDomains.length > 0 ? apiDomains : []).map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => {
                  setProfession(d.nameEn);
                  setSpecialty("");
                  setErrors((e) => ({ ...e, profession: undefined }));
                  loadSpecs(d.id);
                  setDomainPickerVisible(false);
                }}
                style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <VectorIcon name={(d.icon ?? "tool") as any} size={18} color={colors.primary} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>{isRTL ? d.nameAr : d.nameEn}</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>{isRTL ? d.nameEn : d.nameAr}</Text>
                </View>
                {profession === d.nameEn && <VectorIcon name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Specialization picker modal */}
      <Modal visible={specPickerVisible} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setSpecPickerVisible(false)} />
        <View style={{ backgroundColor: colors.card, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "60%" }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "اختر التخصص" : "Select Specialization"}
          </Text>
          {!profession && (
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left", marginBottom: 16 }}>
              {isRTL ? "اختر المجال أولاً" : "Please select a domain first"}
            </Text>
          )}
          <ScrollView>
            {availableSpecs.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  setSpecialty(s.nameEn);
                  setErrors((e) => ({ ...e, specialty: undefined }));
                  setSpecPickerVisible(false);
                }}
                style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1, textAlign: isRTL ? "right" : "left" }}>{isRTL ? s.nameAr : s.nameEn}</Text>
                {specialty === s.nameEn && <VectorIcon name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
      <FanniInput
        label={`${t("register.experience")} (${isRTL ? "سنوات" : "years"})`}
        value={experience}
        onChangeText={(v) => { setExperience(v); setErrors((e) => ({ ...e, experience: undefined })); }}
        keyboardType="numeric"
        required
        placeholder="5"
        error={errors.experience}
      />

      <View style={[styles.timeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "بداية العمل" : "Work Start"} <Text style={{ color: colors.destructive }}>*</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setActivePicker("start")}
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: errors.serviceStart ? colors.destructive : colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{serviceStart}</Text>
            <VectorIcon name="clock" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {errors.serviceStart ? <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>{errors.serviceStart}</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "نهاية العمل" : "Work End"} <Text style={{ color: colors.destructive }}>*</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setActivePicker("end")}
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: errors.serviceEnd ? colors.destructive : colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{serviceEnd}</Text>
            <VectorIcon name="clock" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {errors.serviceEnd ? <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>{errors.serviceEnd}</Text> : null}
        </View>
      </View>

      {/* Android: inline DateTimePicker dialog */}
      {Platform.OS === "android" && activePicker !== null && (
        <DateTimePicker
          mode="time"
          is24Hour
          value={timeStringToDate(activePicker === "start" ? serviceStart : serviceEnd)}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            const which = activePicker;
            setActivePicker(null);
            if (event.type === "set" && date) {
              const ts = dateToTimeString(date);
              if (which === "start") { setServiceStart(ts); setErrors((e) => ({ ...e, serviceStart: undefined, serviceEnd: undefined })); }
              else { setServiceEnd(ts); setErrors((e) => ({ ...e, serviceEnd: undefined })); }
            }
          }}
        />
      )}

      {/* iOS: modal with spinner picker + Done button */}
      {Platform.OS === "ios" && activePicker !== null && (
        <Modal transparent animationType="slide">
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} activeOpacity={1} onPress={() => setActivePicker(null)} />
          <View style={{ backgroundColor: colors.card, paddingBottom: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 12 }}>
              <TouchableOpacity onPress={() => setActivePicker(null)}>
                <Text style={{ color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 16 }}>{isRTL ? "تم" : "Done"}</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              mode="time"
              is24Hour
              display="spinner"
              value={timeStringToDate(activePicker === "start" ? serviceStart : serviceEnd)}
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
                if (date) {
                  const ts = dateToTimeString(date);
                  if (activePicker === "start") { setServiceStart(ts); setErrors((e) => ({ ...e, serviceStart: undefined, serviceEnd: undefined })); }
                  else { setServiceEnd(ts); setErrors((e) => ({ ...e, serviceEnd: undefined })); }
                }
              }}
              style={{ width: "100%" }}
            />
          </View>
        </Modal>
      )}

      <TouchableOpacity style={[styles.uploadBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted }]}>
        <VectorIcon name="image" size={24} color={colors.secondary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 8 }}>
          {t("register.workPhotos")} (5 {isRTL ? "صور" : "photos"})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.uploadBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted, marginTop: 10 }]}>
        <VectorIcon name="award" size={24} color={colors.secondary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 8 }}>
          {t("register.licensePhoto")}
        </Text>
      </TouchableOpacity>
    </View>
  );
  };

  // ── Step 3 Client: Home address ───────────────────────────────────────────
  const renderStep3Client = () => (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accentBlue }]}>
          <VectorIcon name="home" size={20} color={colors.secondary} />
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
          {isRTL ? "عنوان المنزل" : "Home Address"}
        </Text>
      </View>

      <View style={[styles.egyptBadge, { backgroundColor: colors.accent, borderColor: colors.primary, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text style={{ fontSize: 18 }}>🇪🇬</Text>
        <View style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {isRTL ? "جمهورية مصر العربية" : "Arab Republic of Egypt"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
            {isRTL ? "حدد عنوانك الكامل لتصلك الخدمة" : "Set your full address for service delivery"}
          </Text>
        </View>
      </View>

      <LocationPicker
        governorateId={governorateId}
        areaId={areaId}
        onGovernorateChange={setGovernorateId}
        onAreaChange={(id) => { setAreaId(id); if (id) setErrors((e) => ({ ...e, area: undefined })); }}
        street={street}
        onStreetChange={setStreet}
        building={building}
        onBuildingChange={setBuilding}
        floor={floor}
        onFloorChange={setFloor}
        apartment={apartment}
        onApartmentChange={setApartment}
        showDetails
      />
      {errors.area ? (
        <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: -8, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>
          {errors.area}
        </Text>
      ) : null}
    </View>
  );

  // ── Step 3 Tech: Service Categories ───────────────────────────────────────
  const renderStep3Tech = () => (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accent }]}>
          <VectorIcon name="grid" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
          {isRTL ? "تخصصات الخدمة" : "Service Categories"}
        </Text>
      </View>

      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
        {isRTL ? "اختر تخصصاتك حتى يتمكن العملاء من إيجادك — يمكنك تغييرها لاحقاً من ملفك الشخصي" : "Pick your specialties so clients can find you — you can update them later from your profile"}
      </Text>

      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap", gap: 10 }}>
        {(apiDomains.length > 0 ? apiDomains : []).map((domain) => {
          const slug = domain.nameEn.toLowerCase();
          const selected = selectedCategories.includes(slug);
          return (
            <TouchableOpacity
              key={domain.id}
              onPress={() => toggleCategory(slug)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: colors.radius,
                borderWidth: 1.5,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.accent : colors.card,
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {selected && <VectorIcon name="check" size={13} color={colors.primary} />}
              <Text style={{ color: selected ? colors.primary : colors.foreground, fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium", fontSize: 13 }}>
                {isRTL ? domain.nameAr : domain.nameEn}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedCategories.length === 0 && (
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 14, textAlign: isRTL ? "right" : "left" }}>
          {isRTL ? "يمكنك المتابعة بدون اختيار تخصص الآن" : "You can continue without selecting a category for now"}
        </Text>
      )}
    </View>
  );

  // ── Step 4 Tech: Location ──────────────────────────────────────────────────
  const renderStep4Tech = () => (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accentBlue }]}>
          <VectorIcon name="map-pin" size={20} color={colors.secondary} />
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
          {t("register.step3")}
        </Text>
      </View>

      {/* Egypt badge */}
      <View style={[styles.egyptBadge, { backgroundColor: colors.accent, borderColor: colors.primary, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text style={{ fontSize: 18 }}>🇪🇬</Text>
        <View style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {isRTL ? "جمهورية مصر العربية" : "Arab Republic of Egypt"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
            {isRTL ? "نطاق الخدمة: الإسكندرية ومحافظات مصر" : "Service coverage: Alexandria & Egypt"}
          </Text>
        </View>
      </View>

      <LocationPicker
        governorateId={governorateId}
        areaId={areaId}
        onGovernorateChange={setGovernorateId}
        onAreaChange={(id) => { setAreaId(id); if (id) setErrors((e) => ({ ...e, area: undefined })); }}
        street={street}
        onStreetChange={setStreet}
        building={building}
        onBuildingChange={setBuilding}
        floor={floor}
        onFloorChange={setFloor}
        apartment={apartment}
        onApartmentChange={setApartment}
        showDetails
      />
      {errors.area ? (
        <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: -8, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>
          {errors.area}
        </Text>
      ) : null}
    </View>
  );

  // ── OTP inline step ────────────────────────────────────────────────────────
  const renderOtpStep = () => {
    const maskedMobile = normalizedMobile().replace(/^(0\d{2})(\d+)(\d{2})$/, "$1****$3");
    return (
      <View>
        <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.stepIcon, { backgroundColor: colors.accent }]}>
            <VectorIcon name="smartphone" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
            {t("otp.heading")}
          </Text>
        </View>

        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 24, textAlign: isRTL ? "right" : "left", lineHeight: 20 }}>
          {t("otp.sent")} {maskedMobile}
        </Text>

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
          title={otpLoading ? (isRTL ? "جاري التحقق..." : "Verifying...") : t("otp.verify")}
          onPress={handleOtpVerify}
          disabled={otpLoading || otpDigits.join("").length < OTP_LENGTH}
          style={{ marginTop: 20 }}
        />

        <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }]}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
            {t("otp.noCode")}
          </Text>
          {otpCountdown > 0 ? (
            <Text style={{ color: colors.secondary, fontSize: 13, fontFamily: "Inter_500Medium" }}>
              {isRTL ? `إعادة إرسال بعد ${otpCountdown}ث` : `Resend in ${otpCountdown}s`}
            </Text>
          ) : (
            <TouchableOpacity onPress={sendOtp} disabled={otpSending}>
              <Text style={{ color: otpSending ? colors.mutedForeground : colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                {otpSending ? (isRTL ? "جاري الإرسال..." : "Sending...") : t("otp.resend")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!otpRequired && (
          <TouchableOpacity
            style={{ marginTop: 20, alignItems: "center", padding: 10 }}
            onPress={() => { setOtpMode(false); setStep(2); }}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" }}>
              {isRTL ? "تخطي التحقق (وضع التطوير)" : "Skip verification (dev mode)"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderCurrentStep = () => {
    if (regType === "client") {
      if (step === 1) return renderStep1();
      if (step === 2) return renderStep2Client();
      if (step === 3) return renderStep3Client();
    } else {
      if (step === 1) return renderStep1();
      if (step === 2) return renderStep2Tech();
      if (step === 3) return renderStep3Tech();
      if (step === 4) return renderStep4Tech();
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("register.title")} showBack onBack={handleBack} />

      {/* Type Selector */}
      <View style={[styles.typeRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {(["client", "technician"] as RegisterType[]).map((rt) => (
          <TouchableOpacity
            key={rt}
            style={[styles.typeBtn, { backgroundColor: regType === rt ? colors.primary : "transparent", borderRadius: colors.radius - 4 }]}
            onPress={() => { setRegType(rt); setStep(1); setErrors({}); setSelectedCategories([]); }}
          >
            <VectorIcon name={rt === "client" ? "home" : "tool"} size={14} color={regType === rt ? "#FFF" : colors.mutedForeground} />
            <Text style={{ color: regType === rt ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 5 }}>
              {rt === "client" ? t("register.asClient") : t("register.asTech")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {!otpMode && renderStepIndicator()}

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          {otpMode ? renderOtpStep() : renderCurrentStep()}
        </View>

        {!!apiError && step === totalSteps && !otpMode && (
          <View style={[styles.apiErrorBox, { backgroundColor: "#FEE2E2", borderColor: "#EF4444", borderRadius: colors.radius }]}>
            <VectorIcon name="alert-circle" size={14} color="#EF4444" style={{ marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
            <Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, textAlign: isRTL ? "right" : "left" }}>
              {apiError}
            </Text>
          </View>
        )}
        {!otpMode && (
          <View style={[styles.navBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {step > 1 && (
              <FanniButton
                title={t("common.back")}
                onPress={handleBack}
                variant="outline"
                style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
              />
            )}
            <FanniButton
              title={step < totalSteps ? t("common.next") : t("common.save")}
              onPress={handleNext}
              loading={loading}
              disabled={step === 1 && !getPasswordStrength(password, isRTL).isStrong}
              style={{ flex: 1 }}
            />
          </View>
        )}
        {otpMode && (
          <View style={[styles.navBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <FanniButton
              title={t("common.back")}
              onPress={handleBack}
              variant="outline"
              style={{ flex: 1 }}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  typeRow: { margin: 12, padding: 4, borderRadius: 14 },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  stepRow: { alignItems: "center", justifyContent: "center", marginBottom: 20 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepLine: { flex: 1, height: 2, maxWidth: 60 },
  stepHeader: { alignItems: "center", marginBottom: 20 },
  stepIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepTitle: { fontSize: 17 },
  card: { padding: 20, marginBottom: 16, shadowColor: "#0D1B2A", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 },
  uploadBox: { borderWidth: 1.5, borderStyle: "dashed", paddingVertical: 22, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  optionRow: { padding: 14, marginBottom: 10, borderWidth: 1.5, alignItems: "center" },
  optionIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  timeRow: { gap: 0, marginBottom: 4 },
  egyptBadge: { padding: 12, borderWidth: 1.5, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  navBtns: { gap: 8, marginBottom: 8 },
  apiErrorBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, padding: 12, marginBottom: 12 },
  otpRow: { gap: 10, justifyContent: "center", marginBottom: 8 },
  digitBox: { flex: 1, aspectRatio: 1, maxWidth: 50, borderWidth: 2, borderRadius: 12, fontSize: 22, fontFamily: "Inter_700Bold" },
  otpErrorBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 12 },
  loginPrompt: { alignItems: "center", gap: 4, marginTop: 2, marginBottom: 10 },
  loginPromptText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  loginPromptLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
