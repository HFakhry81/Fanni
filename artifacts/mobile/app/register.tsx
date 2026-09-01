import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform, TextInput, Modal, Image, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import VectorIcon, { type IconName, toIconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import AddressBlock, { AddressValue, EMPTY_ADDRESS } from "@/components/AddressBlock";
import AppHeader from "@/components/AppHeader";
import PasswordStrengthBar, { getPasswordStrength } from "@/components/PasswordStrengthBar";
import KeyboardAwareScrollViewCompat from "@/components/KeyboardAwareScrollViewCompat";
import WorkHoursPickerSheet from "@/components/WorkHoursPickerSheet";
import { getApiBase } from "@/utils/api";
import { openTermsOfUse } from "@/utils/terms";
import { appendImageToFormData } from "@/utils/appendImageToFormData";
import { getTechnicianIdPhotosError } from "@/utils/technicianRegisterValidation";
import { setAuthToken } from "@/utils/authTokenStorage";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;
const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

interface ApiDomain { id: string; nameEn: string; nameAr: string; icon: string | null; }
interface ApiSpec { id: string; domainId: string; nameEn: string; nameAr: string; }

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
  const [bio, setBio] = useState("");

  // ── ID & License photo URIs (stored locally, uploaded after registration) ─
  const [nationalIdFrontUri, setNationalIdFrontUri] = useState<string | null>(null);
  const [nationalIdBackUri, setNationalIdBackUri] = useState<string | null>(null);
  const [licenseCardUri, setLicenseCardUri] = useState<string | null>(null);
  const [, setUploadingPhoto] = useState<"front" | "back" | "license" | null>(null);

  // ── Location (shared) ──────────────────────────────────────────────────────
  const [addrVal, setAddrVal] = useState<AddressValue>(EMPTY_ADDRESS);

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
  const scrollRef = useRef<import("react-native").ScrollView | null>(null);
  const idPhotosSectionY = useRef(0);

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

  // If OTP becomes disabled mid-session while the OTP screen is open, auto-advance past it
  useEffect(() => {
    if (otpMode && !otpRequired) {
      setOtpMode(false);
      setStep(2);
    }
  }, [otpRequired, otpMode]);

  const normalizedMobile = useCallback((): string => {
    const mobileDigits = mobile.trim().replace(/\s|-/g, "");
    const m = mobileDigits.match(EGYPT_MOBILE_RE);
    return m ? `0${m[2]}` : mobileDigits;
  }, [mobile]);

  const sendOtp = useCallback(async () => {
    // Re-fetch config so the OTP requirement reflects any mid-session server change
    try {
      const cfg = await fetch(`${getApiBase()}/api/config`).then((r) => r.json()) as { otpEnabled?: boolean };
      setOtpRequired(!!cfg.otpEnabled);
    } catch { /* keep current value on network error */ }
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

  // ── Photo picker helper ────────────────────────────────────────────────────
  const pickPhoto = useCallback(async (slot: "front" | "back" | "license") => {
    // On web, media-library permission is not required for the file picker.
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          isRTL ? "الإذن مطلوب" : "Permission Required",
          isRTL ? "يرجى السماح بالوصول إلى الصور" : "Please allow access to your photo library",
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: Platform.OS !== "web",
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (slot === "front") setNationalIdFrontUri(uri);
      else if (slot === "back") setNationalIdBackUri(uri);
      else setLicenseCardUri(uri);
      if (slot === "front" || slot === "back") {
        setErrors((e) => ({ ...e, idPhotos: undefined }));
      }
    }
  }, [isRTL]);

  const pickPhotoCamera = useCallback(async (slot: "front" | "back" | "license") => {
    if (Platform.OS === "web") {
      // Browsers: open file picker (camera devices appear there when available).
      await pickPhoto(slot);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "الإذن مطلوب" : "Permission Required",
        isRTL ? "يرجى السماح بالوصول إلى الكاميرا" : "Please allow camera access",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (slot === "front") setNationalIdFrontUri(uri);
      else if (slot === "back") setNationalIdBackUri(uri);
      else setLicenseCardUri(uri);
      if (slot === "front" || slot === "back") {
        setErrors((e) => ({ ...e, idPhotos: undefined }));
      }
    }
  }, [isRTL, pickPhoto]);

  const showPhotoPicker = useCallback(
    (slot: "front" | "back" | "license", _label: string) => {
      // RN Alert action buttons are unreliable on web — go straight to the file picker.
      if (Platform.OS === "web") {
        void pickPhoto(slot);
        return;
      }
      Alert.alert(isRTL ? "رفع صورة" : "Upload Photo", _label, [
        { text: isRTL ? "المعرض" : "Photo Library", onPress: () => pickPhoto(slot) },
        { text: isRTL ? "الكاميرا" : "Camera", onPress: () => pickPhotoCamera(slot) },
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
      ]);
    },
    [isRTL, pickPhoto, pickPhotoCamera],
  );

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
    terms?: string;
    idPhotos?: string;
  }>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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

      if (!email.trim()) {
        newErrors.email = isRTL ? "البريد الإلكتروني مطلوب" : "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        newErrors.email = isRTL ? "صيغة البريد الإلكتروني غير صحيحة" : "Invalid email format";
      }

      const mobileDigits = mobile.trim().replace(/\s|-/g, "");
      if (!mobileDigits) {
        newErrors.mobile = isRTL ? "رقم الهاتف مطلوب" : "Mobile number is required";
      } else if (!mobileDigits.match(EGYPT_MOBILE_RE)) {
        newErrors.mobile = isRTL ? "صيغة غير صحيحة — مثال: 01XXXXXXXXX" : "Invalid format — e.g. 01XXXXXXXXX";
      }

      if (regType === "technician" && !nationalId.trim()) {
        newErrors.nationalId = isRTL ? "الرقم القومي مطلوب" : "National ID is required";
      } else if (regType === "technician" && !/^\d{14}$/.test(nationalId.trim())) {
        newErrors.nationalId = isRTL ? "الرقم القومي يجب أن يكون 14 رقمًا" : "National ID must be exactly 14 digits";
      }

      if (regType === "technician") {
        const idPhotoError = getTechnicianIdPhotosError(nationalIdFrontUri, nationalIdBackUri, isRTL);
        if (idPhotoError) newErrors.idPhotos = idPhotoError;
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
      } else if (isNaN(expNum) || expNum < 0) {
        newErrors.experience = isRTL ? "يجب أن تكون الخبرة عدداً موجباً" : "Experience must be a positive number";
      } else if (expNum > 70) {
        newErrors.experience = isRTL ? "الحد الأقصى لسنوات الخبرة 70" : "Experience cannot exceed 70 years";
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
      if (!addrVal.governorateId) {
        newErrors.area = isRTL ? "يرجى اختيار المحافظة" : "Please select a governorate";
      } else if (!addrVal.areaId) {
        newErrors.area = isRTL ? "يرجى اختيار المنطقة" : "Please select an area";
      } else if (Platform.OS !== "web" && addrVal.latitude == null) {
        newErrors.area = isRTL ? "يرجى تثبيت الموقع على الخريطة" : "Please pin your location on the map";
      } else if (Platform.OS === "web" && addrVal.latitude == null) {
        // Web: map pin optional — governorate + area are enough for registration
      }
      if (!acceptedTerms) {
        newErrors.terms = t(regType === "technician" ? "terms.requiredTech" : "terms.requiredClient");
      }
    }

    setErrors(newErrors);
    if (newErrors.idPhotos) {
      Alert.alert(
        isRTL ? "صور البطاقة مطلوبة" : "ID photos required",
        newErrors.idPhotos,
      );
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(idPhotosSectionY.current - 24, 0), animated: true });
      });
    }
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
      if (regType === "technician") {
        const idPhotoError = getTechnicianIdPhotosError(nationalIdFrontUri, nationalIdBackUri, isRTL);
        if (idPhotoError) {
          setStep(1);
          setErrors({ idPhotos: idPhotoError });
          setApiError(idPhotoError);
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: Math.max(idPhotosSectionY.current - 24, 0), animated: true });
          });
          return;
        }
      }
      setLoading(true);
      // Re-check OTP setting before submitting — it may have changed mid-session
      try {
        const cfg = await fetch(`${getApiBase()}/api/config`).then((r) => r.json()) as { otpEnabled?: boolean };
        const nowRequired = !!cfg.otpEnabled;
        setOtpRequired(nowRequired);
        if (nowRequired && !verificationToken) {
          // OTP became required — redirect user through OTP before registration
          setLoading(false);
          setOtpDigits(Array(OTP_LENGTH).fill(""));
          setOtpError("");
          setOtpMode(true);
          await sendOtp();
          return;
        }
      } catch { /* keep current state on network error */ }
      try {
        const apiBase = getApiBase();
        if (!apiBase) {
          setApiError(isRTL ? "عنوان الخادم غير مضبوط في التطبيق" : "API base URL is not configured");
          return;
        }
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
            governorateId: addrVal.governorateId || undefined,
            areaId: addrVal.areaId || undefined,
            street: addrVal.street || undefined,
            buildingNo: addrVal.buildingNo || undefined,
            floorNo: addrVal.floorNo || undefined,
            aptNo: addrVal.aptNo || undefined,
            latitude: addrVal.latitude ?? undefined,
            longitude: addrVal.longitude ?? undefined,
            verificationToken: verificationToken || undefined,
            profession: regType === "technician" && profession.trim() ? profession.trim() : undefined,
            specialty: regType === "technician" && specialty.trim() ? specialty.trim() : undefined,
            serviceCategories: regType === "technician" && selectedCategories.length > 0 ? selectedCategories : undefined,
            serviceStart: regType === "technician" ? serviceStart.trim() : undefined,
            serviceEnd: regType === "technician" ? serviceEnd.trim() : undefined,
            bio: regType === "technician" && bio.trim() ? bio.trim() : undefined,
            yearsOfExperience: regType === "technician" && experience.trim() ? Number(experience.trim()) : undefined,
            workingHours: regType === "technician"
              ? Object.fromEntries(
                  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [
                    d,
                    { start: serviceStart.trim(), end: serviceEnd.trim(), enabled: true },
                  ]),
                )
              : undefined,
            acceptedTerms: true,
          }),
        });
        const raw = await res.text();
        let data: { token?: string; user?: { id: string }; error?: string } = {};
        try {
          data = raw ? JSON.parse(raw) as typeof data : {};
        } catch {
          const hint = raw.replace(/\s+/g, " ").slice(0, 120);
          setApiError(
            isRTL
              ? `الخادم ردّ برد غير متوقع (${res.status})${hint ? `: ${hint}` : ""}. إن استمر الخطأ انشر آخر نسخة API على الـ VPS.`
              : `Unexpected server response (${res.status})${hint ? `: ${hint}` : ""}. If this persists, deploy the latest API to the VPS.`,
          );
          return;
        }
        if (!res.ok) {
          setApiError(
            data.error
              || (isRTL ? `فشل التسجيل (${res.status})` : `Registration failed (${res.status})`),
          );
          return;
        }
        if (data.token) {
          try {
            await setAuthToken(data.token);
          } catch {
            setApiError(isRTL ? "تم إنشاء الحساب لكن تعذّر حفظ الجلسة على الجهاز" : "Account created but session could not be saved on device");
            return;
          }

          // Upload ID photos + license card if provided (tech only)
          if (regType === "technician" && (nationalIdFrontUri || nationalIdBackUri || licenseCardUri)) {
            try {
              setUploadingPhoto("front");
              const photoUpdates: Record<string, string> = {};

              const uploadOne = async (uri: string | null, field: string, slot: "front" | "back" | "license") => {
                if (!uri) return;
                setUploadingPhoto(slot);
                const formData = new FormData();
                const mime =
                  uri.includes(".png") || uri.startsWith("data:image/png")
                    ? "image/png"
                    : uri.includes(".webp") || uri.startsWith("data:image/webp")
                      ? "image/webp"
                      : "image/jpeg";
                formData.append("purpose", slot === "license" ? "carnehat" : "id");
                await appendImageToFormData(formData, "file", uri, mime);
                const uploadRes = await fetch(`${apiBase}/api/upload`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${data.token!}` },
                  body: formData,
                });
                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json() as { url?: string };
                  if (uploadData.url) photoUpdates[field] = uploadData.url;
                }
              };

              await uploadOne(nationalIdFrontUri, "nationalIdFrontUrl", "front");
              await uploadOne(nationalIdBackUri, "nationalIdBackUrl", "back");
              await uploadOne(licenseCardUri, "licenseCardUrl", "license");

              if (Object.keys(photoUpdates).length > 0) {
                await fetch(`${apiBase}/api/auth/me`, {
                  method: "PATCH",
                  headers: { Authorization: `Bearer ${data.token!}`, "Content-Type": "application/json" },
                  body: JSON.stringify(photoUpdates),
                });
              }
            } catch { /* non-fatal — photos can be re-uploaded from profile */ } finally {
              setUploadingPhoto(null);
            }
          }

          await refreshUser();
          let confirmedCategories: string[] = regType === "technician" ? selectedCategories : [];
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
              confirmedCategories = savedCategories;
            } catch {
              setApiError(isRTL ? "تعذّر التحقق من حفظ تخصصاتك" : "Could not verify your service categories were saved.");
              return;
            }
          }
          const categoryMeta = apiDomains
            .filter((d) => confirmedCategories.includes(d.id))
            .map((d) => ({ id: d.id, nameAr: d.nameAr, nameEn: d.nameEn, icon: d.icon ?? null }));
          router.replace({
            pathname: "/register-success",
            params: {
              name: name.trim(),
              role: regType,
              categories: JSON.stringify(confirmedCategories),
              categoryMeta: JSON.stringify(categoryMeta),
            },
          });
        } else {
          const msg = data.error ?? "Unknown error";
          if (msg.includes("Mobile number is already registered")) {
            setApiError(isRTL ? "رقم الهاتف مسجل بالفعل" : "Mobile number is already registered");
          } else if (msg.includes("Email address is already registered")) {
            setApiError(isRTL ? "البريد الإلكتروني مسجل بالفعل" : "Email address is already registered");
          } else if (msg.includes("Too many")) {
            setApiError(isRTL ? "محاولات كثيرة جداً، يرجى الانتظار" : "Too many attempts, please wait");
          } else if (msg.includes("PostGIS") || msg.includes("Location storage")) {
            setApiError(isRTL ? "تعذّر حفظ الموقع على الخادم (PostGIS). راجع إعداد قاعدة البيانات." : msg);
          } else {
            setApiError(msg || (isRTL ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again"));
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

  const paymentOptions: { id: PaymentMethod; label: string; icon: IconName }[] = [
    { id: "bank",     label: t("register.bankAccount"), icon: "credit-card" },
    { id: "ewallet",  label: t("register.eWallet"),     icon: "smartphone"  },
    { id: "instapay", label: t("register.instaPay"),    icon: "zap"         },
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
        hint={isRTL ? "اكتب الاسم كما يظهر في البطاقة" : "Enter your full legal name"}
        error={errors.name}
      />
      {regType === "technician" && (
        <FanniInput label={t("register.age")} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" hint={isRTL ? "اختياري" : "Optional"} />
      )}
      <FanniInput
        label={isRTL ? "رقم الهاتف" : "Mobile Number"}
        value={mobile}
        onChangeText={(v) => { setMobile(v); setMobileTaken(false); setErrors((e) => ({ ...e, mobile: undefined })); }}
        keyboardType="phone-pad" required
        placeholder="01XXXXXXXXX"
        hint={isRTL ? "رقم مصري صحيح: 010 / 011 / 012 / 015 ثم 8 أرقام" : "Egyptian mobile: 010 / 011 / 012 / 015 + 8 digits"}
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
        hint={isRTL ? "صيغة صحيحة مثل name@gmail.com" : "Valid format e.g. name@gmail.com"}
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
      <PasswordStrengthBar password={password} alwaysShow />

      <FanniInput
        label={isRTL ? "تأكيد كلمة المرور" : "Confirm Password"}
        value={confirmPassword}
        onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: undefined })); }}
        secureTextEntry
        required
        placeholder={isRTL ? "أعد إدخال كلمة المرور" : "Re-enter your password"}
        hint={isRTL ? "يجب أن تطابق كلمة المرور أعلاه" : "Must match the password above"}
        error={errors.confirmPassword}
      />

      {regType === "technician" && (
        <FanniInput
          label={isRTL ? "الرقم القومي" : "National ID"}
          value={nationalId}
          onChangeText={(v) => { setNationalId(v); if (v.trim()) setErrors((e) => ({ ...e, nationalId: undefined })); }}
          keyboardType="numeric" required
          placeholder="2XXXXXXXXXXXXXX"
          maxLength={14}
          hint={isRTL ? "14 رقمًا كما في بطاقة الرقم القومي" : "14 digits as on your national ID card"}
          error={errors.nationalId}
        />
      )}

      {regType === "technician" && (
        <View
          style={{ gap: 10 }}
          onLayout={(e) => { idPhotosSectionY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: isRTL ? "right" : "left", marginBottom: 2 }}>
            {isRTL ? "صور بطاقة الهوية الوطنية" : "National ID Photos"} <Text style={{ color: colors.destructive }}>*</Text>
          </Text>
          <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", gap: 10 }]}>
            {/* Front */}
            <TouchableOpacity
              style={[styles.uploadBox, { borderColor: errors.idPhotos && !nationalIdFrontUri ? colors.destructive : nationalIdFrontUri ? colors.primary : colors.border, borderRadius: colors.radius, backgroundColor: colors.muted, flex: 1 }]}
              onPress={() => showPhotoPicker("front", isRTL ? "وجه البطاقة" : "ID Front")}
            >
              {nationalIdFrontUri ? (
                <Image source={{ uri: nationalIdFrontUri }} style={{ width: 80, height: 60, borderRadius: 6 }} resizeMode="cover" />
              ) : (
                <VectorIcon name="camera" size={22} color={colors.secondary} />
              )}
              <Text style={{ color: nationalIdFrontUri ? colors.primary : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 6, textAlign: "center" }}>
                {isRTL ? "وجه البطاقة" : "ID Front"}
              </Text>
              {nationalIdFrontUri && (
                <VectorIcon name="check-circle" size={14} color={colors.primary} style={{ marginTop: 2 }} />
              )}
            </TouchableOpacity>
            {/* Back */}
            <TouchableOpacity
              style={[styles.uploadBox, { borderColor: errors.idPhotos && !nationalIdBackUri ? colors.destructive : nationalIdBackUri ? colors.primary : colors.border, borderRadius: colors.radius, backgroundColor: colors.muted, flex: 1 }]}
              onPress={() => showPhotoPicker("back", isRTL ? "ظهر البطاقة" : "ID Back")}
            >
              {nationalIdBackUri ? (
                <Image source={{ uri: nationalIdBackUri }} style={{ width: 80, height: 60, borderRadius: 6 }} resizeMode="cover" />
              ) : (
                <VectorIcon name="camera" size={22} color={colors.secondary} />
              )}
              <Text style={{ color: nationalIdBackUri ? colors.primary : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 6, textAlign: "center" }}>
                {isRTL ? "ظهر البطاقة" : "ID Back"}
              </Text>
              {nationalIdBackUri && (
                <VectorIcon name="check-circle" size={14} color={colors.primary} style={{ marginTop: 2 }} />
              )}
            </TouchableOpacity>
          </View>
          {errors.idPhotos ? (
            <Text style={{ color: colors.destructive, fontSize: 12, textAlign: isRTL ? "right" : "left" }}>{errors.idPhotos}</Text>
          ) : null}
        </View>
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
            <VectorIcon name={opt.icon} size={18} color={paymentMethod === opt.id ? colors.primary : colors.mutedForeground} />
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
                <VectorIcon name={toIconName(d.icon)} size={18} color={colors.primary} style={{ marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 }} />
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
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
        {`${t("register.experience")} (${isRTL ? "سنوات" : "years"})`} <Text style={{ color: colors.destructive }}>*</Text>
      </Text>
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 10, marginBottom: errors.experience ? 4 : 6 }}>
        <TouchableOpacity
          onPress={() => {
            const n = Math.max(0, (Number(experience) || 0) - 1);
            setExperience(String(n));
            setErrors((e) => ({ ...e, experience: undefined }));
          }}
          style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 22, color: colors.foreground, fontFamily: "Inter_700Bold" }}>−</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <FanniInput
            value={experience}
            onChangeText={(v) => {
              const cleaned = v.replace(/[^\d]/g, "").slice(0, 2);
              setExperience(cleaned);
              setErrors((e) => ({ ...e, experience: undefined }));
            }}
            keyboardType="numeric"
            placeholder="5"
            error={undefined}
            style={{ marginBottom: 0 }}
          />
        </View>
        <TouchableOpacity
          onPress={() => {
            const n = Math.min(70, (Number(experience) || 0) + 1);
            setExperience(String(n));
            setErrors((e) => ({ ...e, experience: undefined }));
          }}
          style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 22, color: colors.foreground, fontFamily: "Inter_700Bold" }}>+</Text>
        </TouchableOpacity>
      </View>
      {errors.experience ? (
        <Text style={{ color: colors.destructive, fontSize: 12, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>{errors.experience}</Text>
      ) : (
        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>
          {isRTL ? "من 0 إلى 70 سنة — استخدم +/− أو اكتب الرقم" : "0–70 years — use +/− or type the number"}
        </Text>
      )}

      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 4, textAlign: isRTL ? "right" : "left" }}>
        {isRTL ? "ساعات العمل الافتراضية" : "Default work hours"} <Text style={{ color: colors.destructive }}>*</Text>
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 10, textAlign: isRTL ? "right" : "left", lineHeight: 16 }}>
        {isRTL
          ? "تُحفظ في ملفك الشخصي كوقت العمل الافتراضي (بداية – نهاية)."
          : "Saved on your profile as your default daily work window (start – end)."}
      </Text>
      <View style={[styles.timeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "بداية العمل" : "Work Start"}
          </Text>
          <TouchableOpacity
            onPress={() => setActivePicker("start")}
            delayPressIn={0}
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: errors.serviceStart ? colors.destructive : colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{serviceStart}</Text>
            <VectorIcon name="clock" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {errors.serviceStart ? <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>{errors.serviceStart}</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "نهاية العمل" : "Work End"}
          </Text>
          <TouchableOpacity
            onPress={() => setActivePicker("end")}
            delayPressIn={0}
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: errors.serviceEnd ? colors.destructive : colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{serviceEnd}</Text>
            <VectorIcon name="clock" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {errors.serviceEnd ? <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>{errors.serviceEnd}</Text> : null}
        </View>
      </View>

      <WorkHoursPickerSheet
        visible={activePicker !== null}
        title={
          activePicker === "start"
            ? (isRTL ? "اختر بداية العمل" : "Pick work start")
            : (isRTL ? "اختر نهاية العمل" : "Pick work end")
        }
        value={activePicker === "start" ? serviceStart : serviceEnd}
        presets={activePicker === "start" ? ["08:00", "09:00", "10:00"] : ["16:00", "18:00", "22:00"]}
        onCancel={() => setActivePicker(null)}
        onConfirm={(hhmm) => {
          if (activePicker === "start") {
            setServiceStart(hhmm);
            setErrors((e) => ({ ...e, serviceStart: undefined, serviceEnd: undefined }));
          } else {
            setServiceEnd(hhmm);
            setErrors((e) => ({ ...e, serviceEnd: undefined }));
          }
          setActivePicker(null);
        }}
      />

      <FanniInput
        label={isRTL ? "نبذة شخصية (اختياري)" : "Bio (optional)"}
        value={bio}
        onChangeText={setBio}
        placeholder={isRTL ? "اكتب نبذة مختصرة عن خبرتك..." : "Write a brief description of your experience..."}
        multiline
        numberOfLines={3}
        style={{ minHeight: 80 }}
      />

      {/* License Card Upload */}
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: isRTL ? "right" : "left", marginBottom: 8, marginTop: 4 }}>
        {isRTL ? "كارنيه مزاولة المهنة" : "Professional License Card"}
      </Text>
      <TouchableOpacity
        style={[styles.uploadBox, { borderColor: licenseCardUri ? colors.primary : colors.border, borderRadius: colors.radius, backgroundColor: colors.muted }]}
        onPress={() => showPhotoPicker("license", isRTL ? "كارنيه مزاولة المهنة" : "Professional License Card")}
      >
        {licenseCardUri ? (
          <Image source={{ uri: licenseCardUri }} style={{ width: 120, height: 80, borderRadius: 8 }} resizeMode="cover" />
        ) : (
          <VectorIcon name="award" size={24} color={colors.secondary} />
        )}
        <Text style={{ color: licenseCardUri ? colors.primary : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 8 }}>
          {licenseCardUri ? (isRTL ? "تم الرفع ✓" : "Uploaded ✓") : (isRTL ? "ارفع صورة الكارنيه" : "Upload License Card Photo")}
        </Text>
        {!licenseCardUri && (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3 }}>
            {isRTL ? "وجه وظهر الكارنيه" : "Front and back of license"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
  };

  const renderTermsAcceptance = () => {
    const isTech = regType === "technician";
    const audience = isTech ? "technician" : "client";
    return (
      <View style={{ marginTop: 18 }}>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left", marginBottom: 8 }}>
          {t(isTech ? "terms.titleTech" : "terms.titleClient")}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 20, textAlign: isRTL ? "right" : "left", marginBottom: 10 }}>
          {t(isTech ? "terms.summaryTech" : "terms.summaryClient")}
        </Text>
        <TouchableOpacity
          onPress={() => { void openTermsOfUse(audience); }}
          style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 6, marginBottom: 12 }}
          activeOpacity={0.7}
        >
          <VectorIcon name="file-text" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, textDecorationLine: "underline" }}>
            {t("terms.readFull")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setAcceptedTerms((v) => !v); setErrors((e) => ({ ...e, terms: undefined })); }}
          style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "flex-start", gap: 10 }}
        >
          <View style={{
            width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, marginTop: 1,
            borderColor: acceptedTerms ? colors.primary : colors.border,
            backgroundColor: acceptedTerms ? colors.primary : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {acceptedTerms && <VectorIcon name="check" size={12} color="#FFF" />}
          </View>
          <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
            {t(isTech ? "terms.acceptTech" : "terms.acceptClient")}
          </Text>
        </TouchableOpacity>
        {!!errors.terms && (
          <Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 8, textAlign: isRTL ? "right" : "left" }}>
            {errors.terms}
          </Text>
        )}
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

      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 12, textAlign: isRTL ? "right" : "left", lineHeight: 20 }}>
        {isRTL
          ? "أدخل عنوان منزلك بالترتيب: المحافظة ← المنطقة ← الخريطة. على الويب يمكنك التسجيل بدون تثبيت الخريطة وإكمالها لاحقاً."
          : "Enter your home address in order: governorate → area → map. On web you may register without a map pin and complete it later."}
      </Text>

      <AddressBlock
        value={addrVal}
        onChange={(v) => { setAddrVal(v); setErrors((e) => ({ ...e, area: undefined })); }}
        error={errors.area}
        mapPinRequired={Platform.OS !== "web"}
      />
      {renderTermsAcceptance()}
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
          const selected = selectedCategories.includes(domain.id);
          return (
            <TouchableOpacity
              key={domain.id}
              onPress={() => toggleCategory(domain.id)}
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

      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 12, textAlign: isRTL ? "right" : "left", lineHeight: 20 }}>
        {isRTL
          ? "حدد نطاق خدمتك: المحافظة والمنطقة إلزاميان. تثبيت الخريطة مطلوب على الهاتف واختياري على الويب."
          : "Set your service area: governorate and area are required. Map pin is required on mobile, optional on web."}
      </Text>

      <AddressBlock
        value={addrVal}
        onChange={(v) => { setAddrVal(v); setErrors((e) => ({ ...e, area: undefined })); }}
        error={errors.area}
        mapPinRequired={Platform.OS !== "web"}
      />
      {renderTermsAcceptance()}
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
            onPress={() => { setRegType(rt); setStep(1); setErrors({}); setSelectedCategories([]); setAcceptedTerms(false); }}
          >
            <VectorIcon name={rt === "client" ? "home" : "tool"} size={14} color={regType === rt ? "#FFF" : colors.mutedForeground} />
            <Text style={{ color: regType === rt ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 5 }}>
              {rt === "client" ? t("register.asClient") : t("register.asTech")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAwareScrollViewCompat
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]}
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
      </KeyboardAwareScrollViewCompat>
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
