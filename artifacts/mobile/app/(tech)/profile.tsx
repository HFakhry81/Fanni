import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Modal, TextInput, KeyboardAvoidingView, Alert, Image, ActivityIndicator, type AlertButton,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import StarRating from "@/components/StarRating";
import AppHeader from "@/components/AppHeader";
import LocationPicker from "@/components/LocationPicker";
import Toast from "@/components/Toast";
import PasswordStrengthBar, { getPasswordStrength } from "@/components/PasswordStrengthBar";
import OtpVerifyModal from "@/components/OtpVerifyModal";
import { uploadPhotoToServer } from "@/utils/uploadPhoto";
import { useSaveProfile } from "@/hooks/useSaveProfile";

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

export default function TechProfileScreen() {
  const router = useRouter();
  const { openCategories, openServiceArea } = useLocalSearchParams<{ openCategories?: string; openServiceArea?: string }>();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language, isOnline, setIsOnline } = useApp();
  const { logout, sessionToken, refreshUser } = useAuth();
  const { saveProfile } = useSaveProfile();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [editVisible, setEditVisible] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastAction, setToastAction] = useState<{ label: string; onPress: () => void } | undefined>(undefined);
  const undoAvatarRef = useRef<string | undefined>(undefined);
  const editScrollRef = useRef<ScrollView>(null);
  const categoriesYRef = useRef<number>(0);
  const serviceAreaYRef = useRef<number>(0);
  const [highlightCategories, setHighlightCategories] = useState(false);

  const [resendWelcomeLoading, setResendWelcomeLoading] = useState(false);

  // OTP modal state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [pendingMobile, setPendingMobile] = useState("");
  const [otpSubtitle, setOtpSubtitle] = useState<string | undefined>(undefined);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editProfession, setEditProfession] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editGov, setEditGov] = useState("");
  const [editGovNameAr, setEditGovNameAr] = useState<string | undefined>(undefined);
  const [editGovNameEn, setEditGovNameEn] = useState<string | undefined>(undefined);
  const [editArea, setEditArea] = useState("");
  const [editAreaNameAr, setEditAreaNameAr] = useState<string | undefined>(undefined);
  const [editAreaNameEn, setEditAreaNameEn] = useState<string | undefined>(undefined);
  const [editStreet, setEditStreet] = useState("");
  const [editDomainPickerVisible, setEditDomainPickerVisible] = useState(false);
  const [editSpecPickerVisible, setEditSpecPickerVisible] = useState(false);
  const [apiDomains, setApiDomains] = useState<ApiDomain[]>([]);
  const [apiSpecs, setApiSpecs] = useState<ApiSpec[]>([]);

  useEffect(() => {
    fetch(`${getApiBase()}/api/categories/domains`)
      .then((r) => r.json())
      .then((d: { domains?: ApiDomain[] }) => { if (d.domains) setApiDomains(d.domains); })
      .catch(() => {});
  }, []);

  const loadProfileSpecs = useCallback((domainId: string) => {
    fetch(`${getApiBase()}/api/categories/specializations?domainId=${domainId}`)
      .then((r) => r.json())
      .then((d: { specializations?: ApiSpec[] }) => { if (d.specializations) setApiSpecs(d.specializations); })
      .catch(() => {});
  }, []);

  const [editCategories, setEditCategories] = useState<string[]>([]);

  // Change password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<{ current?: string; newPw?: string; confirm?: string }>({});
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Work hours edit state
  const [editServiceStart, setEditServiceStart] = useState("08:00");
  const [editServiceEnd, setEditServiceEnd] = useState("22:00");
  const [activeTimePicker, setActiveTimePicker] = useState<"start" | "end" | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<{ name?: string; mobile?: string; gov?: string; area?: string; serviceStart?: string; serviceEnd?: string }>({});

  const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

  useEffect(() => {
    if (openCategories === "1" && user && !editVisible) {
      setHighlightCategories(true);
      openEdit();
      router.replace("/(tech)/profile");
      setTimeout(() => {
        editScrollRef.current?.scrollTo({ y: categoriesYRef.current, animated: true });
      }, 400);
    }
  }, [openCategories]);

  useEffect(() => {
    if (openServiceArea === "1" && user && !editVisible) {
      openEdit();
      router.replace("/(tech)/profile");
      setTimeout(() => {
        editScrollRef.current?.scrollTo({ y: serviceAreaYRef.current, animated: true });
      }, 400);
    }
  }, [openServiceArea, user, editVisible]);

  useEffect(() => {
    if (!editVisible) {
      setHighlightCategories(false);
    }
  }, [editVisible]);

  const toggleCategory = (key: string) => {
    setEditCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  };

  const openEdit = () => {
    if (!user) return;
    setEditName(user.name ?? "");
    setEditMobile(user.mobile ?? "");
    setEditProfession(user.profession ?? "");
    setEditSpecialty(user.specialty ?? "");
    if (user.profession) {
      const dom = apiDomains.find((d) => d.nameEn === user.profession || d.nameAr === user.profession || d.id === user.profession);
      if (dom) loadProfileSpecs(dom.id);
    }
    setEditGov(user.governorate ?? "");
    setEditGovNameAr(user.governorateNameAr);
    setEditGovNameEn(user.governorateNameEn);
    setEditArea(user.area ?? "");
    setEditAreaNameAr(user.areaNameAr);
    setEditAreaNameEn(user.areaNameEn);
    setEditStreet(user.address ?? "");
    setEditCategories(user.serviceCategories ?? []);
    setEditServiceStart(user.serviceStart ?? "08:00");
    setEditServiceEnd(user.serviceEnd ?? "22:00");
    setErrors({});
    setEditVisible(true);
  };

  const handleSave = async () => {
    if (!user) return;

    const newErrors: typeof errors = {};

    if (!editName.trim()) {
      newErrors.name = isRTL ? "الاسم مطلوب" : "Name is required";
    }

    const mobileDigits = editMobile.trim().replace(/\s|-/g, "");
    const mobileMatch = mobileDigits ? mobileDigits.match(EGYPT_MOBILE_RE) : null;
    if (!mobileDigits) {
      newErrors.mobile = isRTL ? "رقم الهاتف مطلوب" : "Mobile number is required";
    } else if (!mobileMatch) {
      newErrors.mobile = isRTL ? "صيغة غير صحيحة — مثال: 01XXXXXXXXX" : "Invalid format — e.g. 01XXXXXXXXX";
    }

    if (!editGov) {
      newErrors.gov = isRTL ? "يرجى اختيار المحافظة" : "Please select a governorate";
    }

    if (!editArea) {
      newErrors.area = isRTL ? "يرجى اختيار المنطقة" : "Please select an area";
    }

    const startValid = TIME_RE.test(editServiceStart.trim());
    const endValid = TIME_RE.test(editServiceEnd.trim());
    if (!startValid) {
      newErrors.serviceStart = isRTL ? "صيغة غير صحيحة — مثال: 08:00" : "Invalid format — e.g. 08:00";
    }
    if (!endValid) {
      newErrors.serviceEnd = isRTL ? "صيغة غير صحيحة — مثال: 22:00" : "Invalid format — e.g. 22:00";
    }
    if (startValid && endValid) {
      const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      if (toMinutes(editServiceEnd.trim()) <= toMinutes(editServiceStart.trim())) {
        newErrors.serviceEnd = isRTL ? "وقت الانتهاء يجب أن يكون بعد وقت البدء" : "Work End must be later than Work Start";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : editMobile.trim();
    setErrors({});

    if (normalizedMobile !== (user.mobile ?? "")) {
      setPendingMobile(normalizedMobile);
      setOtpSubtitle(undefined);
      setOtpModalVisible(true);
      return;
    }

    await applyProfileSave(normalizedMobile, undefined);
  };

  const applyProfileSave = async (normalizedMobile: string, verificationToken: string | undefined) => {
    if (!user) return;

    const nameParts = editName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? editName.trim();
    const lastName = nameParts.slice(1).join(" ") || null;

    const body: Record<string, unknown> = {
      firstName,
      lastName,
      profession: editProfession.trim() || user.profession || null,
      specialty: editSpecialty.trim() || user.specialty || null,
      governorate: editGov || null,
      area: editArea || null,
      address: editStreet.trim() || null,
      serviceCategories: editCategories.length > 0 ? editCategories : null,
      serviceStart: editServiceStart.trim(),
      serviceEnd: editServiceEnd.trim(),
    };
    if (verificationToken) {
      body.mobile = normalizedMobile;
      body.verificationToken = verificationToken;
    }

    const result = await saveProfile(body, {
      address: editStreet.trim(),
      serviceStart: editServiceStart.trim(),
      serviceEnd: editServiceEnd.trim(),
    });

    if (!result.ok) {
      if (result.error && result.error.toLowerCase().includes("expired verification token")) {
        setOtpSubtitle(
          isRTL
            ? "انتهت صلاحية رمز التحقق. سيتم إرسال رمز جديد إلى رقمك."
            : "Your verification code expired. A new code will be sent to your number."
        );
        setOtpModalVisible(true);
        return;
      }
      if (result.error === "offline") {
        await setUser({
          ...user,
          name: editName.trim(),
          mobile: normalizedMobile,
          specialty: editSpecialty.trim() || user.specialty,
          governorate: editGov,
          governorateNameAr: editGovNameAr,
          governorateNameEn: editGovNameEn,
          area: editArea,
          areaNameAr: editAreaNameAr,
          areaNameEn: editAreaNameEn,
          address: editStreet.trim(),
          serviceCategories: editCategories,
          serviceStart: editServiceStart.trim(),
          serviceEnd: editServiceEnd.trim(),
        });
      } else {
        setToastMessage(result.error ?? (isRTL ? "فشل حفظ البيانات على الخادم، حاول مرة أخرى" : "Failed to save to server, please try again"));
        setToastVisible(true);
        return;
      }
    }

    setEditVisible(false);
    setToastMessage(isRTL ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully");
    setToastVisible(true);
  };

  const govText = (isRTL ? user?.governorateNameAr : user?.governorateNameEn) ?? (isRTL ? "الإسكندرية" : "Alexandria");
  const areaText = (isRTL ? user?.areaNameAr : user?.areaNameEn) ?? (isRTL ? "حي شرق" : "Al Sharq District");
  const hasServiceArea = !!(user?.governorate && user?.area);
  const hasCategories = !!(user?.serviceCategories && user.serviceCategories.length > 0);
  const serviceAreaDisplay = hasServiceArea ? `${govText} — ${areaText}` : null;

  const openPwSheet = () => {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwErrors({});
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setPwVisible(true);
  };

  const handlePwSave = async () => {
    if (!user) return;
    const errs: typeof pwErrors = {};

    if (!currentPw) {
      errs.current = isRTL ? "كلمة المرور الحالية مطلوبة" : "Current password is required";
    } else if (user.password && currentPw !== user.password) {
      errs.current = isRTL ? "كلمة المرور الحالية غير صحيحة" : "Current password is incorrect";
    }

    const pwStrength = getPasswordStrength(newPw, isRTL);
    if (!pwStrength.isStrong) {
      errs.newPw = isRTL
        ? "كلمة المرور لا تستوفي متطلبات القوة"
        : "Password does not meet strength requirements";
    } else if (user.password && newPw === user.password) {
      errs.newPw = isRTL ? "يجب أن تختلف كلمة المرور الجديدة عن الحالية" : "New password must differ from the current one";
    }

    if (newPw !== confirmPw) {
      errs.confirm = isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match";
    }

    if (Object.keys(errs).length > 0) {
      setPwErrors(errs);
      return;
    }

    await setUser({ ...user, password: newPw });
    setPwVisible(false);
    setToastMessage(t("profile.passwordUpdated"));
    setToastAction(undefined);
    setToastVisible(true);
  };

  const handleResendWelcome = async () => {
    if (!sessionToken) {
      setToastMessage(t("profile.resendWelcomeError"));
      setToastAction(undefined);
      setToastVisible(true);
      return;
    }
    setResendWelcomeLoading(true);
    try {
      const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
      const apiBase = domain ? `https://${domain}` : "";
      if (!apiBase) {
        setToastMessage(t("profile.resendWelcomeError"));
        setToastAction(undefined);
        setToastVisible(true);
        return;
      }
      const res = await fetch(`${apiBase}/api/auth/resend-welcome`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.status === 429) {
        setToastMessage(t("profile.resendWelcomeRateLimited"));
      } else if (res.status === 400) {
        setToastMessage(t("profile.resendWelcomeNoEmail"));
      } else if (!res.ok) {
        setToastMessage(t("profile.resendWelcomeError"));
      } else {
        const data = await res.json() as { delivered?: boolean };
        setToastMessage(data.delivered ? t("profile.resendWelcomeSent") : t("profile.resendWelcomeError"));
      }
    } catch (_) {
      setToastMessage(t("profile.resendWelcomeError"));
    } finally {
      setResendWelcomeLoading(false);
    }
    setToastAction(undefined);
    setToastVisible(true);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/welcome");
  };

  const handlePickedPhoto = async (uri: string, mimeType: string) => {
    if (!user) return;
    if (!sessionToken) {
      setToastMessage(isRTL ? "يجب تسجيل الدخول لرفع الصورة" : "Sign in required to upload photo");
      setToastVisible(true);
      return;
    }
    setToastMessage(isRTL ? "جاري رفع الصورة..." : "Uploading photo...");
    setToastVisible(true);
    try {
      const { url } = await uploadPhotoToServer(uri, sessionToken, mimeType);
      const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
      if (domain) {
        const patchRes = await fetch(`https://${domain}/api/auth/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ profileImageUrl: url }),
        });
        if (!patchRes.ok) throw new Error(`Server update failed: ${patchRes.status}`);
      }
      await setUser({ ...user, avatar: url });
      refreshUser().catch(() => {});
      setToastMessage(isRTL ? "تم تحديث صورة الملف الشخصي" : "Profile photo updated");
    } catch (_) {
      setToastMessage(isRTL ? "فشل رفع الصورة، يرجى المحاولة مرة أخرى" : "Upload failed, please try again");
    }
    setToastVisible(true);
  };

  const pickPhoto = () => {
    const hasPhoto = !!user?.avatar;
    const buttons: AlertButton[] = [
      {
        text: isRTL ? "الكاميرا" : "Camera",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              isRTL ? "لا يوجد إذن" : "Permission Required",
              isRTL ? "يرجى السماح للتطبيق باستخدام الكاميرا من الإعدادات." : "Please allow camera access in your device settings."
            );
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled && result.assets[0] && user) {
            const asset = result.assets[0];
            const mimeType = asset.mimeType ?? "image/jpeg";
            await handlePickedPhoto(asset.uri, mimeType);
          }
        },
      },
      {
        text: isRTL ? "معرض الصور" : "Photo Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              isRTL ? "لا يوجد إذن" : "Permission Required",
              isRTL ? "يرجى السماح للتطبيق بالوصول إلى معرض الصور من الإعدادات." : "Please allow photo library access in your device settings."
            );
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled && result.assets[0] && user) {
            const asset = result.assets[0];
            const mimeType = asset.mimeType ?? "image/jpeg";
            await handlePickedPhoto(asset.uri, mimeType);
          }
        },
      },
    ];

    if (hasPhoto) {
      buttons.push({
        text: isRTL ? "حذف الصورة" : "Remove Photo",
        style: "destructive" as const,
        onPress: () => {
          Alert.alert(
            isRTL ? "حذف الصورة" : "Remove Photo",
            isRTL ? "هل أنت متأكد أنك تريد حذف صورتك الشخصية؟" : "Are you sure you want to remove your photo?",
            [
              { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
              {
                text: isRTL ? "حذف" : "Remove",
                style: "destructive",
                onPress: async () => {
                  if (user) {
                    const previousAvatar = user.avatar;
                    undoAvatarRef.current = previousAvatar;
                    await setUser({ ...user, avatar: undefined });
                    const apiBase = getApiBase();
                    if (!apiBase || !sessionToken) {
                      await setUser({ ...user, avatar: previousAvatar });
                      undoAvatarRef.current = undefined;
                      setToastMessage(isRTL ? "يجب تسجيل الدخول لحذف الصورة" : "Sign in required to remove photo");
                      setToastAction(undefined);
                      setToastVisible(true);
                      return;
                    }
                    try {
                      const res = await fetch(`${apiBase}/api/auth/me`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
                        body: JSON.stringify({ profileImageUrl: null }),
                      });
                      if (!res.ok) throw new Error(`Server error: ${res.status}`);
                    } catch {
                      await setUser({ ...user, avatar: previousAvatar });
                      undoAvatarRef.current = undefined;
                      setToastMessage(isRTL ? "فشل حذف الصورة، يرجى المحاولة مرة أخرى" : "Failed to remove photo, please try again");
                      setToastAction(undefined);
                      setToastVisible(true);
                      return;
                    }
                    setToastMessage(isRTL ? "تم حذف صورة الملف الشخصي" : "Profile photo removed");
                    setToastAction({
                      label: isRTL ? "تراجع" : "Undo",
                      onPress: async () => {
                        if (user && undoAvatarRef.current !== undefined) {
                          const restoredAvatar = undoAvatarRef.current;
                          await setUser({ ...user, avatar: restoredAvatar });
                          undoAvatarRef.current = undefined;
                          if (apiBase && sessionToken) {
                            try {
                              const res = await fetch(`${apiBase}/api/auth/me`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
                                body: JSON.stringify({ profileImageUrl: restoredAvatar ?? null }),
                              });
                              if (!res.ok) throw new Error(`Server error: ${res.status}`);
                            } catch {
                              await setUser({ ...user, avatar: undefined });
                              setToastMessage(isRTL ? "فشل استعادة الصورة، يرجى المحاولة مرة أخرى" : "Failed to restore photo, please try again");
                              setToastAction(undefined);
                              setToastVisible(true);
                            }
                          }
                        }
                      },
                    });
                    setToastVisible(true);
                  }
                },
              },
            ]
          );
        },
      });
    }

    buttons.push({ text: isRTL ? "إلغاء" : "Cancel", style: "cancel" as const });

    Alert.alert(
      isRTL ? "تغيير صورة الملف الشخصي" : "Change Profile Photo",
      "",
      buttons
    );
  };

  const stats = [
    { label: isRTL ? "الطلبات" : "Orders",       value: "24",                           color: colors.primary   },
    { label: isRTL ? "سنوات الخبرة" : "Years Exp", value: `${user?.experience ?? 5}`,    color: colors.secondary },
    { label: isRTL ? "التقييم" : "Rating",         value: "4.8",                          color: "#22A36B"        },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("profile.title")} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.darkMid }]}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            <View style={[styles.avatarRing, { borderColor: colors.secondary }]}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 34 }}>
                    {(user?.name?.[0] ?? "T").toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.cameraOverlay}>
              <VectorIcon name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 12 }}>{user?.name}</Text>
          <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 4 }}>
            {user?.profession} — {user?.specialty}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 }}>{user?.mobile}</Text>
          <View style={{ marginTop: 12 }}>
            <StarRating rating={4.8} readonly size={20} />
          </View>
          {/* Badges */}
          <View style={[styles.badgesRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.badge, { backgroundColor: "rgba(77,173,217,0.2)", borderColor: colors.secondary }]}>
              <VectorIcon name="shield" size={12} color={colors.secondary} />
              <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 4 }}>
                {isRTL ? "معتمد" : "Verified"}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "rgba(245,166,35,0.2)", borderColor: colors.primary }]}>
              <VectorIcon name="star" size={12} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 4 }}>
                {isRTL ? "متميز" : "Top Rated"}
              </Text>
            </View>
          </View>
          {/* Edit badge */}
          <TouchableOpacity style={[styles.editBadge, { backgroundColor: colors.secondary + "33", borderColor: colors.secondary, borderWidth: 1 }]} onPress={openEdit}>
            <VectorIcon name="edit-2" size={13} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>
              {t("profile.edit")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {stats.map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
              <Text style={{ color: stat.color, fontFamily: "Inter_700Bold", fontSize: 24 }}>{stat.value}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 4 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Service Area Banner */}
        {hasServiceArea ? (
          <View style={[styles.serviceAreaBanner, { backgroundColor: colors.card, borderColor: colors.primary + "30", flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.serviceAreaIcon, { backgroundColor: colors.primary + "15" }]}>
              <VectorIcon name="map-pin" size={14} color={colors.primary} />
            </View>
            <View style={[styles.serviceAreaText, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                {t("tech.serviceArea")}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, marginTop: 1 }}>
                {serviceAreaDisplay}
              </Text>
            </View>
            <View style={[styles.serviceAreaActiveDot, { backgroundColor: "#22A36B" }]} />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.serviceAreaBanner, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={openEdit}
            activeOpacity={0.8}
          >
            <View style={[styles.serviceAreaIcon, { backgroundColor: "#FEF3C7" }]}>
              <VectorIcon name="alert-circle" size={14} color="#D97706" />
            </View>
            <View style={[styles.serviceAreaText, { alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }]}>
              <Text style={{ color: "#92400E", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {t("tech.noServiceArea")}
              </Text>
              <Text style={{ color: "#B45309", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 }}>
                {t("tech.noServiceAreaPrompt")}
              </Text>
            </View>
            <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={14} color="#D97706" />
          </TouchableOpacity>
        )}

        {/* Categories reminder banner */}
        {!hasCategories && (
          <TouchableOpacity
            style={[styles.serviceAreaBanner, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={() => {
              setHighlightCategories(true);
              openEdit();
              setTimeout(() => {
                editScrollRef.current?.scrollTo({ y: categoriesYRef.current, animated: true });
              }, 400);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.serviceAreaIcon, { backgroundColor: "#FFEDD5" }]}>
              <VectorIcon name="grid" size={14} color="#EA580C" />
            </View>
            <View style={[styles.serviceAreaText, { alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }]}>
              <Text style={{ color: "#7C2D12", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {t("tech.noCategories")}
              </Text>
              <Text style={{ color: "#C2410C", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 }}>
                {t("tech.noCategoriesPrompt")}
              </Text>
            </View>
            <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={14} color="#EA580C" />
          </TouchableOpacity>
        )}

        <View style={styles.menuSection}>
          {/* Availability toggle */}
          <TouchableOpacity
            style={[styles.availCard, { backgroundColor: isOnline ? "#22A36B" : "#EF4444", flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={() => setIsOnline(!isOnline, sessionToken ?? undefined)}
            activeOpacity={0.8}
          >
            <View style={[styles.availDot, { backgroundColor: "rgba(255,255,255,0.5)" }]} />
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                {isOnline ? t("tech.online") : t("tech.offline")}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                {isOnline
                  ? (isRTL ? "أنت متاح لاستقبال الطلبات" : "You are available to receive orders")
                  : (isRTL ? "أنت غير متاح — لن تتلقى طلبات جديدة" : "You are offline — no new orders will be received")}
              </Text>
            </View>
            <View style={[styles.availToggleKnob, { backgroundColor: "rgba(255,255,255,0.25)", borderColor: "rgba(255,255,255,0.5)" }]}>
              <VectorIcon name={isOnline ? "toggle-right" : "toggle-left"} size={30} color="#FFF" />
            </View>
          </TouchableOpacity>

          {/* Language toggle */}
          <View style={[styles.langCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <VectorIcon name="globe" size={18} color={colors.secondary} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              {t("profile.language")}
            </Text>
            <View style={[styles.langToggle, { backgroundColor: colors.muted, borderRadius: 20, flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {(["ar", "en"] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langOption, { backgroundColor: language === lang ? colors.primary : "transparent", borderRadius: 16 }]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={{ color: language === lang ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {lang === "ar" ? "العربية" : "English"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Specialty info */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            onPress={openEdit}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.accent, borderRadius: 10 }]}>
              <VectorIcon name="tool" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "التخصص" : "Specialty"}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                {user?.specialty ?? (isRTL ? "صيانة مكيفات" : "AC Maintenance")}
              </Text>
            </View>
            <VectorIcon name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Service Categories display */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, alignItems: "flex-start" }]}
            onPress={openEdit}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <VectorIcon name="grid" size={18} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left", marginBottom: 6 }}>
                {isRTL ? "تخصصات الخدمة" : "Service Categories"}
              </Text>
              {user?.serviceCategories && user.serviceCategories.length > 0 ? (
                <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap", gap: 6 }]}>
                  {user.serviceCategories.map((key) => {
                    const domain = apiDomains.find((d) => d.id === key || d.nameEn.toLowerCase() === key.toLowerCase());
                    const label = domain ? (isRTL ? domain.nameAr : domain.nameEn) : key;
                    return (
                      <View
                        key={key}
                        style={{ backgroundColor: colors.primary + "22", borderColor: colors.primary, borderWidth: 1, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 }}
                      >
                        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "لم يتم تحديد تخصصات بعد" : "No categories selected yet"}
                </Text>
              )}
            </View>
            <VectorIcon name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Service area */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            onPress={openEdit}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <VectorIcon name="map-pin" size={18} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "نطاق الخدمة" : "Service Area"}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                {govText}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1, textAlign: isRTL ? "right" : "left" }}>
                {areaText}
              </Text>
            </View>
            <VectorIcon name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Work Hours */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            onPress={openEdit}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.accent, borderRadius: 10 }]}>
              <VectorIcon name="clock" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "ساعات العمل" : "Work Hours"}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                {`${user?.serviceStart ?? "08:00"} – ${user?.serviceEnd ?? "22:00"}`}
              </Text>
            </View>
            <VectorIcon name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Change Password */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            onPress={openPwSheet}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#22A36B18", borderRadius: 10 }]}>
              <VectorIcon name="lock" size={18} color="#22A36B" />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0, textAlign: isRTL ? "right" : "left" }}>
              {t("profile.changePassword")}
            </Text>
            <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Resend Welcome */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, opacity: resendWelcomeLoading ? 0.6 : 1 }]}
            onPress={resendWelcomeLoading ? undefined : handleResendWelcome}
            activeOpacity={0.8}
            disabled={resendWelcomeLoading}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#4B7BEC18", borderRadius: 10 }]}>
              <VectorIcon name="mail" size={18} color="#4B7BEC" />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0, textAlign: isRTL ? "right" : "left" }}>
              {t("profile.resendWelcome")}
            </Text>
            {resendWelcomeLoading
              ? <ActivityIndicator size="small" color={colors.mutedForeground} />
              : <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.mutedForeground} />
            }
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: "#FFCCCC", flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FFE6E6", borderRadius: 10 }]}>
              <VectorIcon name="log-out" size={18} color={colors.destructive} />
            </View>
            <Text style={{ color: colors.destructive, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0, textAlign: isRTL ? "right" : "left" }}>
              {t("profile.logout")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={pwVisible} animationType="slide" transparent onRequestClose={() => setPwVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: botPad + 16, minHeight: "50%", maxHeight: "80%" }]}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setPwVisible(false)} style={{ padding: 4 }}>
                  <VectorIcon name="x" size={22} color={colors.mutedForeground} />
                </TouchableOpacity>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, flex: 1, textAlign: "center" }}>
                  {t("profile.changePassword")}
                </Text>
                {(() => {
                  const pwOk = newPw.length > 0 && getPasswordStrength(newPw, isRTL).isStrong;
                  return (
                    <TouchableOpacity
                      onPress={handlePwSave}
                      disabled={!pwOk}
                      style={[styles.saveBtn, { backgroundColor: pwOk ? colors.primary : colors.muted }]}
                    >
                      <Text style={{ color: pwOk ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                        {t("common.save")}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                {/* Current Password */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("profile.currentPassword")}
                  </Text>
                  <View style={[styles.pwInputRow, { backgroundColor: colors.card, borderColor: pwErrors.current ? colors.destructive : colors.border }]}>
                    <TextInput
                      value={currentPw}
                      onChangeText={setCurrentPw}
                      placeholder={t("profile.currentPassword")}
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry={!showCurrentPw}
                      style={[styles.pwInput, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                    />
                    <TouchableOpacity onPress={() => setShowCurrentPw((v) => !v)} style={{ padding: 8 }}>
                      <VectorIcon name={showCurrentPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  {pwErrors.current ? (
                    <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{pwErrors.current}</Text>
                  ) : null}
                </View>

                {/* New Password */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("profile.newPassword")}
                  </Text>
                  <View style={[styles.pwInputRow, { backgroundColor: colors.card, borderColor: pwErrors.newPw ? colors.destructive : colors.border }]}>
                    <TextInput
                      value={newPw}
                      onChangeText={setNewPw}
                      placeholder={t("profile.newPassword")}
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry={!showNewPw}
                      style={[styles.pwInput, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                    />
                    <TouchableOpacity onPress={() => setShowNewPw((v) => !v)} style={{ padding: 8 }}>
                      <VectorIcon name={showNewPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  <PasswordStrengthBar password={newPw} />
                  {pwErrors.newPw ? (
                    <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{pwErrors.newPw}</Text>
                  ) : null}
                </View>

                {/* Confirm New Password */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("profile.confirmPassword")}
                  </Text>
                  <View style={[styles.pwInputRow, { backgroundColor: colors.card, borderColor: pwErrors.confirm ? colors.destructive : colors.border }]}>
                    <TextInput
                      value={confirmPw}
                      onChangeText={setConfirmPw}
                      placeholder={t("profile.confirmPassword")}
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry={!showConfirmPw}
                      style={[styles.pwInput, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPw((v) => !v)} style={{ padding: 8 }}>
                      <VectorIcon name={showConfirmPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  {pwErrors.confirm ? (
                    <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{pwErrors.confirm}</Text>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: botPad + 16 }]}>
              {/* Handle */}
              <View style={[styles.handle, { backgroundColor: colors.border }]} />

              {/* Header */}
              <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setEditVisible(false)} style={{ padding: 4 }}>
                  <VectorIcon name="x" size={22} color={colors.mutedForeground} />
                </TouchableOpacity>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, flex: 1, textAlign: "center" }}>
                  {t("profile.edit")}
                </Text>
                <TouchableOpacity
                  onPress={handleSave}
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>{t("common.save")}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView ref={editScrollRef} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                {/* Name */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("register.name")}
                  </Text>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder={t("register.name")}
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.textInput, { backgroundColor: colors.card, borderColor: errors.name ? colors.destructive : colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                  />
                  {errors.name ? (
                    <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{errors.name}</Text>
                  ) : null}
                </View>

                {/* Mobile */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("register.mobile")}
                  </Text>
                  <TextInput
                    value={editMobile}
                    onChangeText={setEditMobile}
                    placeholder="+20 1XX XXX XXXX"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                    style={[styles.textInput, { backgroundColor: colors.card, borderColor: errors.mobile ? colors.destructive : colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                  />
                  {errors.mobile ? (
                    <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{errors.mobile}</Text>
                  ) : null}
                </View>

                {/* Profession (domain) picker */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("register.profession")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setEditDomainPickerVisible(true)}
                    style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Text style={{ color: editProfession ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
                      {editProfession
                        ? (isRTL ? (apiDomains.find((d) => d.nameEn === editProfession || d.id === editProfession)?.nameAr ?? editProfession) : editProfession)
                        : (isRTL ? "اختر المجال" : "Select domain")}
                    </Text>
                    <VectorIcon name="chevron-down" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                {/* Specialty picker */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("register.specialty")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const dom = apiDomains.find((d) => d.nameEn === editProfession || d.id === editProfession);
                      if (dom) loadProfileSpecs(dom.id);
                      setEditSpecPickerVisible(true);
                    }}
                    style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Text style={{ color: editSpecialty ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
                      {editSpecialty
                        ? (isRTL ? (apiSpecs.find((s) => s.nameEn === editSpecialty || s.id === editSpecialty)?.nameAr ?? editSpecialty) : editSpecialty)
                        : (isRTL ? "اختر التخصص" : "Select specialization")}
                    </Text>
                    <VectorIcon name="chevron-down" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                {/* Work Hours */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("register.serviceStart")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setActiveTimePicker("start")}
                    style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: errors.serviceStart ? colors.destructive : colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{editServiceStart}</Text>
                    <VectorIcon name="clock" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {errors.serviceStart ? (
                    <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{errors.serviceStart}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("register.serviceEnd")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setActiveTimePicker("end")}
                    style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: errors.serviceEnd ? colors.destructive : colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{editServiceEnd}</Text>
                    <VectorIcon name="clock" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {errors.serviceEnd ? (
                    <Text style={[styles.errorText, { textAlign: isRTL ? "right" : "left" }]}>{errors.serviceEnd}</Text>
                  ) : null}
                </View>

                {/* Android time picker dialog */}
                {Platform.OS === "android" && activeTimePicker !== null && (
                  <DateTimePicker
                    mode="time"
                    is24Hour
                    value={timeStringToDate(activeTimePicker === "start" ? editServiceStart : editServiceEnd)}
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      const which = activeTimePicker;
                      setActiveTimePicker(null);
                      if (event.type === "set" && date) {
                        const ts = dateToTimeString(date);
                        if (which === "start") { setEditServiceStart(ts); setErrors((e) => ({ ...e, serviceStart: undefined, serviceEnd: undefined })); }
                        else { setEditServiceEnd(ts); setErrors((e) => ({ ...e, serviceEnd: undefined })); }
                      }
                    }}
                  />
                )}

                {/* iOS: modal with spinner picker + Done button */}
                {Platform.OS === "ios" && activeTimePicker !== null && (
                  <Modal transparent animationType="slide">
                    <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} activeOpacity={1} onPress={() => setActiveTimePicker(null)} />
                    <View style={{ backgroundColor: colors.card, paddingBottom: 20 }}>
                      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 12 }}>
                        <TouchableOpacity onPress={() => setActiveTimePicker(null)}>
                          <Text style={{ color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 16 }}>{isRTL ? "تم" : "Done"}</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        mode="time"
                        is24Hour
                        display="spinner"
                        value={timeStringToDate(activeTimePicker === "start" ? editServiceStart : editServiceEnd)}
                        onChange={(_event: DateTimePickerEvent, date?: Date) => {
                          if (date) {
                            const ts = dateToTimeString(date);
                            if (activeTimePicker === "start") { setEditServiceStart(ts); setErrors((e) => ({ ...e, serviceStart: undefined, serviceEnd: undefined })); }
                            else { setEditServiceEnd(ts); setErrors((e) => ({ ...e, serviceEnd: undefined })); }
                          }
                        }}
                        style={{ width: "100%" }}
                      />
                    </View>
                  </Modal>
                )}

                {/* Service Categories */}
                <View
                  style={[
                    styles.fieldWrap,
                    highlightCategories && { borderWidth: 2, borderColor: "#EA580C", borderRadius: 12, padding: 10, backgroundColor: "#FFF7ED" },
                  ]}
                  onLayout={(e) => { categoriesYRef.current = e.nativeEvent.layout.y; }}
                >
                  <Text style={[styles.fieldLabel, { color: highlightCategories ? "#7C2D12" : colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "تخصصات الخدمة" : "Service Categories"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 10, textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? "اختر واحدة أو أكثر من الفئات التي تتقنها" : "Select one or more categories you specialize in"}
                  </Text>
                  <View style={[styles.categoryGrid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    {(apiDomains.length > 0 ? apiDomains : []).map((domain) => {
                      const selected = editCategories.includes(domain.id);
                      return (
                        <TouchableOpacity
                          key={domain.id}
                          onPress={() => toggleCategory(domain.id)}
                          style={[
                            styles.categoryChip,
                            {
                              backgroundColor: selected ? colors.primary : colors.card,
                              borderColor: selected ? colors.primary : colors.border,
                            },
                          ]}
                          activeOpacity={0.7}
                        >
                          {selected && (
                            <VectorIcon name="check" size={12} color="#FFF" style={{ marginRight: isRTL ? 0 : 5, marginLeft: isRTL ? 5 : 0 }} />
                          )}
                          <Text
                            style={{
                              color: selected ? "#FFF" : colors.foreground,
                              fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular",
                              fontSize: 13,
                            }}
                          >
                            {isRTL ? domain.nameAr : domain.nameEn}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Divider */}
                <View onLayout={(e) => { serviceAreaYRef.current = e.nativeEvent.layout.y; }}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                  {t("register.step3")}
                </Text>

                {/* Location errors */}
                {errors.gov ? (
                  <Text style={[styles.errorText, { marginBottom: 6, textAlign: isRTL ? "right" : "left" }]}>{errors.gov}</Text>
                ) : null}
                {errors.area ? (
                  <Text style={[styles.errorText, { marginBottom: 6, textAlign: isRTL ? "right" : "left" }]}>{errors.area}</Text>
                ) : null}

                {/* Location Picker */}
                <LocationPicker
                  governorateId={editGov}
                  areaId={editArea}
                  onGovernorateChange={(id) => { setEditGov(id); setEditArea(""); setEditAreaNameAr(undefined); setEditAreaNameEn(undefined); }}
                  onAreaChange={setEditArea}
                  onGovernorateSelect={(opt) => { setEditGovNameAr(opt.ar); setEditGovNameEn(opt.en); }}
                  onAreaSelect={(opt) => { setEditAreaNameAr(opt.ar); setEditAreaNameEn(opt.en); }}
                  street={editStreet}
                  onStreetChange={setEditStreet}
                  showDetails={false}
                />
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <OtpVerifyModal
        visible={otpModalVisible}
        mobile={pendingMobile}
        subtitle={otpSubtitle}
        onCancel={() => { setOtpModalVisible(false); setOtpSubtitle(undefined); }}
        onVerified={async (token) => {
          setOtpModalVisible(false);
          setOtpSubtitle(undefined);
          await applyProfileSave(pendingMobile, token);
        }}
      />

      <Toast
        visible={toastVisible}
        message={toastMessage}
        duration={toastAction ? 4000 : 2000}
        onHide={() => { setToastVisible(false); setToastAction(undefined); }}
        action={toastAction}
      />

      {/* Domain picker modal for profile edit */}
      <Modal visible={editDomainPickerVisible} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setEditDomainPickerVisible(false)} />
        <View style={{ backgroundColor: colors.card, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 14, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "اختر المجال" : "Select Domain"}
          </Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {apiDomains.map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => {
                  setEditProfession(d.nameEn);
                  setEditSpecialty("");
                  loadProfileSpecs(d.id);
                  setEditDomainPickerVisible(false);
                }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
                  {isRTL ? d.nameAr : d.nameEn}
                </Text>
                {editProfession === d.nameEn && <VectorIcon name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Specialty picker modal for profile edit */}
      <Modal visible={editSpecPickerVisible} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} activeOpacity={1} onPress={() => setEditSpecPickerVisible(false)} />
        <View style={{ backgroundColor: colors.card, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 14, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "اختر التخصص" : "Select Specialization"}
          </Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {apiSpecs.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingVertical: 20 }}>
                {isRTL ? "اختر المجال أولاً" : "Select a domain first"}
              </Text>
            ) : (
              apiSpecs.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => {
                    setEditSpecialty(s.nameEn);
                    setEditSpecPickerVisible(false);
                  }}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
                    {isRTL ? s.nameAr : s.nameEn}
                  </Text>
                  {editSpecialty === s.nameEn && <VectorIcon name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {},
  hero: { alignItems: "center", paddingVertical: 28, paddingBottom: 28 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  cameraOverlay: { position: "absolute", bottom: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  editBadge: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20 },
  badgesRow: { marginTop: 14, gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  statsRow: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 16, borderWidth: 1.5 },
  menuSection: { padding: 16, gap: 10 },
  langCard: { padding: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center" },
  infoCard: { padding: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center" },
  menuIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  langToggle: { padding: 3 },
  langOption: { paddingVertical: 6, paddingHorizontal: 12 },
  logoutBtn: { padding: 16, borderWidth: 2, alignItems: "center" },
  availCard: { padding: 16, borderRadius: 14, flexDirection: "row", alignItems: "center" },
  availDot: { width: 10, height: 10, borderRadius: 5 },
  availToggleKnob: { borderWidth: 1, borderRadius: 10, padding: 2 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", minHeight: "60%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 },
  modalHeader: { alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, marginBottom: 4, borderBottomWidth: 1 },
  saveBtn: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 },
  textInput: { paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1.5, borderRadius: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 10, marginTop: 4 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#E53E3E", marginTop: 4 },
  pwInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 12, paddingLeft: 14, paddingRight: 4 },
  pwInput: { flex: 1, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  categoryGrid: { flexWrap: "wrap", gap: 8 },
  categoryChip: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5 },
  serviceAreaBanner: { marginHorizontal: 16, marginTop: 12, marginBottom: 2, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 10 },
  serviceAreaIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  serviceAreaText: { flex: 1 },
  serviceAreaActiveDot: { width: 8, height: 8, borderRadius: 4 },
});
