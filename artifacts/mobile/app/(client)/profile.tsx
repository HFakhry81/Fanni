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
import AppHeader from "@/components/AppHeader";
import LocationPicker from "@/components/LocationPicker";
import { EGYPT_LOCATIONS } from "@/constants/egyptLocations";

export default function ClientProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language } = useApp();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [editVisible, setEditVisible] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
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
      governorate: editGov,
      area: editArea,
      district: editDistrict,
      address: editStreet.trim(),
    });
    setEditVisible(false);
  };

  const govData = user?.governorate ? EGYPT_LOCATIONS.find((g) => g.id === user.governorate) : null;
  const areaData = govData && user?.area ? govData.areas.find((a) => a.id === user.area) : null;
  const neighborhoodData = areaData && user?.district
    ? areaData.neighborhoods.find((n) => n.id === user.district)
    : null;
  const govText = govData ? (isRTL ? govData.ar : govData.en) : (isRTL ? "الإسكندرية" : "Alexandria");
  const neighborhoodText = neighborhoodData
    ? (isRTL ? neighborhoodData.ar : neighborhoodData.en)
    : areaData ? (isRTL ? areaData.ar : areaData.en) : "";

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

  const menuItems = [
    { icon: "list",       label: t("profile.previousOrders"),   color: colors.primary,   action: () => router.push("/(client)/orders") },
    { icon: "file-text",  label: t("profile.previousInvoices"), color: colors.secondary, action: () => router.push("/(client)/invoices") },
    { icon: "bar-chart-2",label: t("profile.reports"),          color: "#7C5CBF",        action: () => {} },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("profile.title")} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Profile hero */}
        <View style={[styles.profileHero, { backgroundColor: colors.darkMid }]}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 34 }}>
                    {(user?.name?.[0] ?? "U").toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.cameraOverlay}>
              <Feather name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 12 }}>{user?.name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4 }}>{user?.mobile}</Text>
          {user?.email && (
            <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>{user.email}</Text>
          )}
          {/* Edit badge */}
          <TouchableOpacity style={[styles.editBadge, { backgroundColor: colors.primary }]} onPress={openEdit}>
            <Feather name="edit-2" size={13} color="#FFF" />
            <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 5 }}>
              {t("profile.edit")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          {/* Language toggle */}
          <View style={[styles.langCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={[styles.langIconWrap, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
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

          {/* Address card */}
          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={openEdit}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.accentBlue, borderRadius: 10 }]}>
              <Feather name="map-pin" size={18} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "عنوان المنزل" : "Home Address"}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                {govText}{neighborhoodText ? ` — ${neighborhoodText}` : ""}
              </Text>
              {user?.address ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                  {user.address}
                </Text>
              ) : null}
            </View>
            <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Menu items */}
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
              onPress={item.action}
              activeOpacity={0.8}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + "18", borderRadius: 10 }]}>
                <Feather name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0, textAlign: isRTL ? "right" : "left" }}>
                {item.label}
              </Text>
              <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}

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

              <ScrollView contentContainerStyle={{ padding: 16, gap: 0 }} showsVerticalScrollIndicator={false}>
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

                {/* Divider */}
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                  {t("register.address")}
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
  profileHero: { alignItems: "center", paddingVertical: 28, paddingBottom: 32 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  cameraOverlay: { position: "absolute", bottom: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  editBadge: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20 },
  menuSection: { padding: 16, gap: 10 },
  langCard: { padding: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center" },
  langIconWrap: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  langToggle: { padding: 3 },
  langOption: { paddingVertical: 6, paddingHorizontal: 12 },
  menuItem: { padding: 16, borderWidth: 1.5, alignItems: "center" },
  menuIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  infoCard: { padding: 14, borderWidth: 1.5, alignItems: "center" },
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
