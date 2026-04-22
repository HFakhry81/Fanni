import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Modal, TextInput, KeyboardAvoidingView, Alert, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import StarRating from "@/components/StarRating";
import AppHeader from "@/components/AppHeader";
import LocationPicker from "@/components/LocationPicker";
import { EGYPT_LOCATIONS } from "@/constants/egyptLocations";

export default function TechProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language } = useApp();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [editVisible, setEditVisible] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editGov, setEditGov] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editStreet, setEditStreet] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<{ name?: string; mobile?: string; gov?: string; area?: string }>({});

  const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

  const openEdit = () => {
    if (!user) return;
    setEditName(user.name ?? "");
    setEditMobile(user.mobile ?? "");
    setEditSpecialty(user.specialty ?? "");
    setEditGov(user.governorate ?? "");
    setEditArea(user.area ?? "");
    setEditDistrict(user.district ?? "");
    setEditStreet(user.address ?? "");
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

    setErrors({});
    await setUser({
      ...user,
      name: editName.trim(),
      mobile: normalizedMobile,
      specialty: editSpecialty.trim() || user.specialty,
      governorate: editGov,
      area: editArea,
      district: editDistrict,
      address: editStreet.trim(),
    });
    setEditVisible(false);
  };

  const govData = user?.governorate ? EGYPT_LOCATIONS.find((g) => g.id === user.governorate) : null;
  const areaData = govData && user?.area ? govData.areas.find((a) => a.id === user.area) : null;
  const govText = govData ? (isRTL ? govData.ar : govData.en) : (isRTL ? "الإسكندرية" : "Alexandria");
  const areaText = areaData ? (isRTL ? areaData.ar : areaData.en) : (isRTL ? "حي شرق" : "Al Sharq District");

  const handleLogout = async () => {
    await setUser(null);
    router.replace("/welcome");
  };

  const pickPhoto = () => {
    const options = [
      isRTL ? "الكاميرا" : "Camera",
      isRTL ? "معرض الصور" : "Photo Library",
      isRTL ? "إلغاء" : "Cancel",
    ];
    Alert.alert(
      isRTL ? "تغيير صورة الملف الشخصي" : "Change Profile Photo",
      "",
      [
        {
          text: options[0],
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
            }
          },
        },
        {
          text: options[1],
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
            }
          },
        },
        { text: options[2], style: "cancel" },
      ]
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
});
