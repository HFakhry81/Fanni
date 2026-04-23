import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Modal, TextInput, KeyboardAvoidingView, Alert, Image, type AlertButton,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import StarRating from "@/components/StarRating";
import AppHeader from "@/components/AppHeader";
import LocationPicker from "@/components/LocationPicker";
import Toast from "@/components/Toast";
import { EGYPT_LOCATIONS } from "@/constants/egyptLocations";
import PasswordStrengthBar, { getPasswordStrength } from "@/components/PasswordStrengthBar";

const SERVICE_CATEGORIES = [
  { key: "electricity", ar: "كهرباء", en: "Electricity" },
  { key: "plumbing", ar: "سباكة", en: "Plumbing" },
  { key: "ac", ar: "تكييف", en: "Air Conditioning" },
  { key: "carpentry", ar: "نجارة", en: "Carpentry" },
  { key: "appliances", ar: "أجهزة منزلية", en: "Appliances" },
  { key: "painting", ar: "دهانات", en: "Painting" },
  { key: "pest", ar: "مكافحة حشرات", en: "Pest Control" },
  { key: "flooring", ar: "أرضيات", en: "Flooring" },
] as const;

export default function TechProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language, isOnline, setIsOnline } = useApp();
  const { logout, sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [editVisible, setEditVisible] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editGov, setEditGov] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editCategories, setEditCategories] = useState<string[]>([]);

  // Change password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrors, setPwErrors] = useState<{ current?: string; newPw?: string; confirm?: string }>({});
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{ name?: string; mobile?: string; gov?: string; area?: string }>({});

  const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

  const toggleCategory = (key: string) => {
    setEditCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  };

  const openEdit = () => {
    if (!user) return;
    setEditName(user.name ?? "");
    setEditMobile(user.mobile ?? "");
    setEditSpecialty(user.specialty ?? "");
    setEditGov(user.governorate ?? "");
    setEditArea(user.area ?? "");
    setEditDistrict(user.district ?? "");
    setEditStreet(user.address ?? "");
    setEditCategories(user.serviceCategories ?? []);
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

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : editMobile.trim();
    const nameParts = editName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? editName.trim();
    const lastName = nameParts.slice(1).join(" ") || null;

    setErrors({});

    if (sessionToken) {
      try {
        const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
        const apiBase = domain ? `https://${domain}` : "";
        if (apiBase) {
          const res = await fetch(`${apiBase}/api/auth/me`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              firstName,
              lastName,
              specialty: editSpecialty.trim() || user.specialty || null,
              governorate: editGov || null,
              area: editArea || null,
              district: editDistrict || null,
              serviceCategories: editCategories.length > 0 ? editCategories : null,
            }),
          });
          if (!res.ok) {
            setToastMessage(isRTL ? "فشل حفظ البيانات على الخادم، حاول مرة أخرى" : "Failed to save to server, please try again");
            setToastVisible(true);
            return;
          }
        }
      } catch (_) {
        setToastMessage(isRTL ? "تعذّر الاتصال بالخادم" : "Could not reach server");
        setToastVisible(true);
        return;
      }
    }

    await setUser({
      ...user,
      name: editName.trim(),
      mobile: normalizedMobile,
      specialty: editSpecialty.trim() || user.specialty,
      governorate: editGov,
      area: editArea,
      district: editDistrict,
      address: editStreet.trim(),
      serviceCategories: editCategories,
    });
    setEditVisible(false);
    setToastMessage(isRTL ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully");
    setToastVisible(true);
  };

  const govData = user?.governorate ? EGYPT_LOCATIONS.find((g) => g.id === user.governorate) : null;
  const areaData = govData && user?.area ? govData.areas.find((a) => a.id === user.area) : null;
  const govText = govData ? (isRTL ? govData.ar : govData.en) : (isRTL ? "الإسكندرية" : "Alexandria");
  const areaText = areaData ? (isRTL ? areaData.ar : areaData.en) : (isRTL ? "حي شرق" : "Al Sharq District");

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
    Alert.alert(
      isRTL ? "تم" : "Done",
      t("profile.passwordUpdated")
    );
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/welcome");
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
            base64: true,
          });
          if (!result.canceled && result.assets[0] && user) {
            const uri = result.assets[0].base64
              ? `data:image/jpeg;base64,${result.assets[0].base64}`
              : result.assets[0].uri;
            await setUser({ ...user, avatar: uri });
            setToastMessage(isRTL ? "تم تحديث صورة الملف الشخصي" : "Profile photo updated");
            setToastVisible(true);
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
            base64: true,
          });
          if (!result.canceled && result.assets[0] && user) {
            const uri = result.assets[0].base64
              ? `data:image/jpeg;base64,${result.assets[0].base64}`
              : result.assets[0].uri;
            await setUser({ ...user, avatar: uri });
            setToastMessage(isRTL ? "تم تحديث صورة الملف الشخصي" : "Profile photo updated");
            setToastVisible(true);
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
                    await setUser({ ...user, avatar: undefined });
                    setToastMessage(isRTL ? "تم حذف صورة الملف الشخصي" : "Profile photo removed");
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
              <Feather name="camera" size={14} color="#FFF" />
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
              <Feather name="shield" size={12} color={colors.secondary} />
              <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 4 }}>
                {isRTL ? "معتمد" : "Verified"}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "rgba(245,166,35,0.2)", borderColor: colors.primary }]}>
              <Feather name="star" size={12} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 4 }}>
                {isRTL ? "متميز" : "Top Rated"}
              </Text>
            </View>
          </View>
          {/* Edit badge */}
          <TouchableOpacity style={[styles.editBadge, { backgroundColor: colors.secondary + "33", borderColor: colors.secondary, borderWidth: 1 }]} onPress={openEdit}>
            <Feather name="edit-2" size={13} color={colors.secondary} />
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
              <Feather name={isOnline ? "toggle-right" : "toggle-left"} size={30} color="#FFF" />
            </View>
          </TouchableOpacity>

          {/* Language toggle */}
          <View style={[styles.langCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <Feather name="globe" size={18} color={colors.secondary} />
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
              <Feather name="tool" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "التخصص" : "Specialty"}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                {user?.specialty ?? (isRTL ? "صيانة مكيفات" : "AC Maintenance")}
              </Text>
            </View>
            <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Service Categories display */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, alignItems: "flex-start" }]}
            onPress={openEdit}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <Feather name="grid" size={18} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left", marginBottom: 6 }}>
                {isRTL ? "تخصصات الخدمة" : "Service Categories"}
              </Text>
              {user?.serviceCategories && user.serviceCategories.length > 0 ? (
                <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap", gap: 6 }]}>
                  {user.serviceCategories.map((key) => {
                    const cat = SERVICE_CATEGORIES.find((c) => c.key === key);
                    return (
                      <View
                        key={key}
                        style={{ backgroundColor: colors.primary + "22", borderColor: colors.primary, borderWidth: 1, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 }}
                      >
                        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                          {cat ? (isRTL ? cat.ar : cat.en) : key}
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
            <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Service area */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            onPress={openEdit}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <Feather name="map-pin" size={18} color={colors.secondary} />
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
            <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Change Password */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
            onPress={openPwSheet}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#22A36B18", borderRadius: 10 }]}>
              <Feather name="lock" size={18} color="#22A36B" />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0, textAlign: isRTL ? "right" : "left" }}>
              {t("profile.changePassword")}
            </Text>
            <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: "#FFCCCC", flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FFE6E6", borderRadius: 10 }]}>
              <Feather name="log-out" size={18} color={colors.destructive} />
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
                  <Feather name="x" size={22} color={colors.mutedForeground} />
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
                      <Feather name={showCurrentPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
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
                      <Feather name={showNewPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
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
                      <Feather name={showConfirmPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
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
                  <Feather name="x" size={22} color={colors.mutedForeground} />
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

              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
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

                {/* Specialty */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t("register.specialty")}
                  </Text>
                  <TextInput
                    value={editSpecialty}
                    onChangeText={setEditSpecialty}
                    placeholder={isRTL ? "مثال: صيانة مكيفات" : "e.g. AC Maintenance"}
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
                  />
                </View>

                {/* Service Categories */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "تخصصات الخدمة" : "Service Categories"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 10, textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? "اختر واحدة أو أكثر من الفئات التي تتقنها" : "Select one or more categories you specialize in"}
                  </Text>
                  <View style={[styles.categoryGrid, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    {SERVICE_CATEGORIES.map((cat) => {
                      const selected = editCategories.includes(cat.key);
                      return (
                        <TouchableOpacity
                          key={cat.key}
                          onPress={() => toggleCategory(cat.key)}
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
                            <Feather name="check" size={12} color="#FFF" style={{ marginRight: isRTL ? 0 : 5, marginLeft: isRTL ? 5 : 0 }} />
                          )}
                          <Text
                            style={{
                              color: selected ? "#FFF" : colors.foreground,
                              fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular",
                              fontSize: 13,
                            }}
                          >
                            {isRTL ? cat.ar : cat.en}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Divider */}
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
                  neighborhoodId={editDistrict}
                  onGovernorateChange={setEditGov}
                  onAreaChange={setEditArea}
                  onNeighborhoodChange={setEditDistrict}
                  street={editStreet}
                  onStreetChange={setEditStreet}
                  showDetails={false}
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
      />
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
});
