import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform, ImageBackground, Image, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import LocationPicker from "@/components/LocationPicker";
import AppHeader from "@/components/AppHeader";
import type { LocationOption } from "@/components/LocationPicker";
import { uploadPhotoToServer } from "@/utils/uploadPhoto";
import type { OrderPhoto } from "@/context/OrderContext";

// ── API helpers (mirror of LocationPicker) ────────────────────────────────────
function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

interface LocationRow { id: string; nameAr: string; nameEn: string; }

async function apiFetchGovernorates(): Promise<LocationRow[]> {
  const base = getApiBase();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/api/locations/governorates`);
    const json = await res.json();
    return json.governorates ?? [];
  } catch { return []; }
}

async function apiFetchAreas(govId: string): Promise<LocationRow[]> {
  const base = getApiBase();
  if (!base || !govId) return [];
  try {
    const res = await fetch(`${base}/api/locations/${govId}/areas`);
    const json = await res.json();
    return json.areas ?? [];
  } catch { return []; }
}

const SUB_IMAGE_MAP: Record<string, ReturnType<typeof require>> = {
  sub_electrical_wiring: require("@/assets/images/sub_electrical_wiring.png"),
  sub_computers:         require("@/assets/images/sub_computers.png"),
  sub_washing_machine:   require("@/assets/images/sub_washing_machine.png"),
  sub_water_heater:      require("@/assets/images/sub_water_heater.png"),
  sub_ac_repair:         require("@/assets/images/sub_ac_repair.png"),
  sub_ac_cleaning:       require("@/assets/images/sub_ac_cleaning.png"),
  sub_pipes:             require("@/assets/images/sub_pipes.png"),
  sub_sanitary:          require("@/assets/images/sub_sanitary.png"),
  sub_doors:             require("@/assets/images/sub_doors.png"),
  sub_furniture:         require("@/assets/images/sub_furniture.png"),
  sub_fridge:            require("@/assets/images/sub_fridge.png"),
  sub_dishwasher:        require("@/assets/images/sub_dishwasher.png"),
  sub_interior_paint:    require("@/assets/images/sub_interior_paint.png"),
  sub_exterior_paint:    require("@/assets/images/sub_exterior_paint.png"),
  sub_insects:           require("@/assets/images/sub_insects.png"),
  sub_rodents:           require("@/assets/images/sub_rodents.png"),
  sub_tiles:             require("@/assets/images/sub_tiles.png"),
  sub_parquet:           require("@/assets/images/sub_parquet.png"),
};

type OrderStep = 1 | 2 | 3;

const DRAFT_KEY = "fanni_order_draft";
const DRAFT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export default function NewOrderScreen() {
  const { category = "", subCategory = "", subImageKey = "" } = useLocalSearchParams<{ category: string; subCategory: string; subImageKey: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { addOrder } = useOrders();
  const { sessionToken, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<OrderStep>(1);
  const [loading, setLoading] = useState(false);

  // ── Order photos ─────────────────────────────────────────────────────────────
  const [orderPhotos, setOrderPhotos] = useState<OrderPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  const [problemDesc, setProblemDesc] = useState("");
  const [deviceType, setDeviceType] = useState("");

  // ── Step 2 – Location ───────────────────────────────────────────────────────
  const [governorateId, setGovernorateId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [govOpt, setGovOpt] = useState<LocationOption | null>(null);
  const [areaOpt, setAreaOpt] = useState<LocationOption | null>(null);
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [landmark, setLandmark] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");

  const draftRestoredRef = useRef(false);

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const stepLabels = [t("order.describe"), t("order.schedule"), t("order.confirm")];

  // ── Draft restore: when auth finishes loading and user is authenticated ──────
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (draftRestoredRef.current) return;
    if (!category && !subCategory) return; // wait for route params to settle

    (async () => {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      let draft: Record<string, unknown>;
      try {
        draft = JSON.parse(raw);
      } catch (err) {
        console.warn("[Fanni] Failed to parse order draft:", err);
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      // Discard expired drafts
      if (typeof draft.savedAt === "number" && Date.now() - draft.savedAt > DRAFT_TTL_MS) {
        console.log("[Fanni] Order draft expired — discarding");
        await AsyncStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (draft.category !== category || draft.subCategory !== subCategory) {
        return; // leave draft untouched — it belongs to a different order flow
      }
      draftRestoredRef.current = true;
      if (draft.problemDesc)    setProblemDesc(draft.problemDesc as string);
      if (draft.deviceType)     setDeviceType(draft.deviceType as string);
      if (draft.governorateId)  setGovernorateId(draft.governorateId as string);
      if (draft.areaId)         setAreaId(draft.areaId as string);
      if (draft.govOpt)         setGovOpt(draft.govOpt as LocationOption);
      if (draft.areaOpt)        setAreaOpt(draft.areaOpt as LocationOption);
      if (draft.street)         setStreet(draft.street as string);
      if (draft.building)       setBuilding(draft.building as string);
      if (draft.floor)          setFloor(draft.floor as string);
      if (draft.apartment)      setApartment(draft.apartment as string);
      if (draft.landmark)       setLandmark(draft.landmark as string);
      if (draft.latitude  != null) setLatitude(draft.latitude as number);
      if (draft.longitude != null) setLongitude(draft.longitude as number);
      if (draft.visitDate)      setVisitDate(draft.visitDate as string);
      if (draft.visitTime)      setVisitTime(draft.visitTime as string);
      setStep(3);
      await AsyncStorage.removeItem(DRAFT_KEY);
    })();
  }, [authLoading, isAuthenticated, category, subCategory]);

  // ── Fallback: resolve govOpt / areaOpt from API if IDs exist but labels are missing ──
  // Handles older drafts that were saved before govOpt/areaOpt were tracked in state.
  useEffect(() => {
    if (!governorateId) return;
    if (govOpt && areaOpt) return;       // both already resolved — nothing to do
    if (govOpt && !areaId) return;       // gov resolved, no area selected — nothing to do

    (async () => {
      let resolvedGovOpt = govOpt;

      if (!govOpt) {
        const rows = await apiFetchGovernorates();
        const match = rows.find((r) => r.id === governorateId);
        if (match) {
          resolvedGovOpt = { id: match.id, ar: match.nameAr, en: match.nameEn };
          setGovOpt(resolvedGovOpt);
        }
      }

      if (areaId && !areaOpt) {
        const rows = await apiFetchAreas(governorateId);
        const match = rows.find((r) => r.id === areaId);
        if (match) {
          setAreaOpt({ id: match.id, ar: match.nameAr, en: match.nameEn });
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorateId, areaId]);

  // ── Save draft and trigger login ─────────────────────────────────────────────
  const handleLoginToSubmit = async () => {
    const draft = {
      category, subCategory,
      problemDesc, deviceType,
      governorateId, areaId,
      govOpt, areaOpt,
      street, building, floor, apartment, landmark,
      latitude, longitude,
      visitDate, visitTime,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    const result = await login();
    // Only discard the draft when the login definitively failed or was abandoned.
    // "opened" means the browser is still open; "success" means auth completed.
    // For any other unexpected result we keep the draft to avoid data loss.
    if (result === "cancel" || result === "dismiss" || result === "error" || result === "locked") {
      await AsyncStorage.removeItem(DRAFT_KEY);
    }
  };

  const handleNext = () => { if (step < 3) setStep((step + 1) as OrderStep); };
  const handleBack = () => {
    if (step > 1) setStep((step - 1) as OrderStep);
    else router.back();
  };

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    const orderId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;

    const fullAddress = [
      govOpt  ? (isRTL ? govOpt.ar  : govOpt.en)  : "",
      areaOpt ? (isRTL ? areaOpt.ar : areaOpt.en) : "",
      street,
    ].filter(Boolean).join(isRTL ? "، " : ", ");

    const newOrder = {
      id: orderId,
      orderNumber,
      clientId: user?.id ?? "client1",
      clientName: user?.name ?? "",
      clientMobile: user?.mobile ?? "",
      category: category as string,
      subCategory: subCategory as string,
      problemDescription: problemDesc,
      deviceType,
      photos: orderPhotos,
      street: fullAddress,
      building, floor, apartment, landmark,
      governorate: govOpt ? govOpt.en.toLowerCase() : undefined,
      area: areaOpt ? areaOpt.en.toLowerCase() : undefined,
      latitude:  latitude  ?? undefined,
      longitude: longitude ?? undefined,
      visitDate, visitTime,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };

    await addOrder(newOrder);

    const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
    if (domain) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (sessionToken) {
          headers["Authorization"] = `Bearer ${sessionToken}`;
        }
        const res = await fetch(`https://${domain}/api/orders`, {
          method: "POST",
          headers,
          body: JSON.stringify(newOrder),
        });
        if (!res.ok) {
          console.warn("[Fanni] Failed to broadcast order to server:", res.status);
        }
      } catch (err) {
        console.warn("[Fanni] Could not reach order notification server:", err);
      }
    }

    await AsyncStorage.removeItem(DRAFT_KEY);
    setLoading(false);
    router.replace("/(client)/orders");
  };

  // ── Order photo picking ───────────────────────────────────────────────────────
  const MAX_PHOTOS = 4;

  const pickOrderPhoto = async () => {
    if (orderPhotos.length >= MAX_PHOTOS) {
      Alert.alert(
        isRTL ? "الحد الأقصى" : "Maximum Reached",
        isRTL ? `يمكنك إضافة ${MAX_PHOTOS} صور كحد أقصى.` : `You can add up to ${MAX_PHOTOS} photos.`
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        isRTL ? "لا يوجد إذن" : "Permission Required",
        isRTL ? "يرجى السماح للتطبيق بالوصول إلى معرض الصور من الإعدادات." : "Please allow photo library access in your settings."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (sessionToken) {
      setPhotoUploading(true);
      try {
        const mimeType = asset.mimeType ?? "image/jpeg";
        const { url } = await uploadPhotoToServer(asset.uri, sessionToken, mimeType);
        setOrderPhotos((prev) => [...prev, { id: photoId, uri: url }]);
      } catch (_) {
        setOrderPhotos((prev) => [...prev, { id: photoId, uri: asset.uri }]);
      } finally {
        setPhotoUploading(false);
      }
    } else {
      setOrderPhotos((prev) => [...prev, { id: photoId, uri: asset.uri }]);
    }
  };

  const removeOrderPhoto = (id: string) => {
    setOrderPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // ── Step 1: Describe ────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View>
      <View style={[styles.categoryBadge, { backgroundColor: colors.accent, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <VectorIcon name="tag" size={14} color={colors.primary} />
        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
          {t(`cat.${category}`)} — {subCategory}
        </Text>
      </View>

      <FanniInput
        label={t("order.problemDesc")}
        value={problemDesc} onChangeText={setProblemDesc}
        multiline numberOfLines={4}
        placeholder={isRTL ? "اشرح المشكلة بالتفصيل..." : "Describe the problem in detail..."}
        required
      />
      <FanniInput
        label={t("order.deviceType")}
        value={deviceType} onChangeText={setDeviceType}
        placeholder={isRTL ? "مثال: مكيف سبليت 1.5 حصان" : "e.g. Split AC 1.5HP"}
      />

      <Text style={[styles.uploadLabel, { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign: isRTL ? "right" : "left" }]}>
        {t("order.photos")}
      </Text>
      <View style={[styles.photosRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {orderPhotos.map((photo) => (
          <TouchableOpacity
            key={photo.id}
            style={[styles.photoBox, { borderColor: colors.primary, borderRadius: colors.radius, overflow: "hidden", borderStyle: "solid" }]}
            onPress={() => {
              Alert.alert(
                isRTL ? "حذف الصورة" : "Remove Photo",
                isRTL ? "هل تريد حذف هذه الصورة؟" : "Remove this photo?",
                [
                  { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
                  { text: isRTL ? "حذف" : "Remove", style: "destructive", onPress: () => removeOrderPhoto(photo.id) },
                ]
              );
            }}
          >
            <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            <View style={{ position: "absolute", top: 3, right: 3, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, padding: 2 }}>
              <VectorIcon name="x" size={10} color="#FFF" />
            </View>
          </TouchableOpacity>
        ))}
        {orderPhotos.length < MAX_PHOTOS && (
          <TouchableOpacity
            style={[styles.photoBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted }]}
            onPress={pickOrderPhoto}
            disabled={photoUploading}
          >
            {photoUploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <VectorIcon name="plus" size={22} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── Step 2: Address / Schedule ──────────────────────────────────────────────
  const renderStep2 = () => (
    <View>
      {/* Egypt badge */}
      <View style={[styles.egyptBadge, { backgroundColor: colors.accent, borderColor: colors.primary, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text style={{ fontSize: 18 }}>🇪🇬</Text>
        <View style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0, flex: 1 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {isRTL ? "عنوان الزيارة" : "Visit Address"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
            {isRTL ? "الإسكندرية ومحافظات مصر" : "Alexandria & all Egypt governorates"}
          </Text>
        </View>
      </View>

      <LocationPicker
        governorateId={governorateId}
        areaId={areaId}
        onGovernorateChange={(id) => { setGovernorateId(id); if (!id) { setGovOpt(null); setAreaOpt(null); } }}
        onAreaChange={(id) => { setAreaId(id); if (!id) setAreaOpt(null); }}
        onGovernorateSelect={(opt) => { setGovOpt(opt); setAreaOpt(null); }}
        onAreaSelect={(opt) => setAreaOpt(opt)}
        street={street}
        onStreetChange={setStreet}
        building={building}
        onBuildingChange={setBuilding}
        floor={floor}
        onFloorChange={setFloor}
        apartment={apartment}
        onApartmentChange={setApartment}
        showDetails
        latitude={latitude}
        longitude={longitude}
        onCoordsChange={(lat, lon) => { setLatitude(lat); setLongitude(lon); }}
      />

      <FanniInput
        label={isRTL ? "علامة مميزة" : "Landmark"}
        value={landmark} onChangeText={setLandmark}
        placeholder={isRTL ? "مثال: بجانب مسجد..." : "e.g. Near the mosque..."}
      />

      {/* Schedule */}
      <View style={[styles.scheduleHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.scheduleIcon, { backgroundColor: colors.accentBlue }]}>
          <VectorIcon name="calendar" size={16} color={colors.secondary} />
        </View>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
          {isRTL ? "موعد الزيارة" : "Visit Schedule"}
        </Text>
      </View>

      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <FanniInput
          label={t("order.visitDate")} value={visitDate} onChangeText={setVisitDate}
          placeholder="2025-01-25"
          style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
        />
        <FanniInput
          label={t("order.visitTime")} value={visitTime} onChangeText={setVisitTime}
          placeholder="10:00 ص"
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );

  // ── Step 3: Confirm ─────────────────────────────────────────────────────────
  const renderStep3 = () => {
    const rows = [
      { label: isRTL ? "نوع الخدمة" : "Service",     value: `${t(`cat.${category}`)} — ${subCategory}` },
      { label: t("order.problemDesc"),                 value: problemDesc || "—" },
      { label: t("order.deviceType"),                  value: deviceType || "—" },
      { label: isRTL ? "المحافظة" : "Governorate",    value: govOpt  ? (isRTL ? govOpt.ar  : govOpt.en)  : "—" },
      { label: isRTL ? "المنطقة" : "Area",            value: areaOpt ? (isRTL ? areaOpt.ar : areaOpt.en) : "—" },
      { label: isRTL ? "الشارع" : "Street",           value: street || "—" },
      { label: t("order.visitDate"),                   value: visitDate || "—" },
      { label: t("order.visitTime"),                   value: visitTime || "—" },
    ];

    return (
      <View>
        <View style={[styles.confirmHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.confirmIcon, { backgroundColor: colors.accent }]}>
            <VectorIcon name="check-circle" size={22} color={colors.primary} />
          </View>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
            {t("order.confirm")}
          </Text>
        </View>

        {rows.map((item) => (
          <View
            key={item.label}
            style={[styles.confirmRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }}>
              {item.label}
            </Text>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 2, textAlign: isRTL ? "left" : "right" }}>
              {item.value}
            </Text>
          </View>
        ))}

        <View style={[styles.totalRow, { backgroundColor: colors.accent, borderColor: colors.primary, borderRadius: colors.radius }]}>
          <VectorIcon name="dollar-sign" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: 8 }}>
            {isRTL ? "سيتم تحديد السعر بعد الكشف" : "Price will be set after inspection"}
          </Text>
        </View>

        {!isAuthenticated && (
          <View style={[styles.loginNotice, { backgroundColor: colors.accentBlue, borderRadius: colors.radius }]}>
            <VectorIcon name="lock" size={16} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: 8, flex: 1 }}>
              {isRTL
                ? "سجّل دخولك لتأكيد الطلب — بياناتك محفوظة"
                : "Sign in to confirm — your details are saved"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("order.new")} showBack onBack={() => router.back()} />
        <View style={styles.authGate}>
          <VectorIcon name="loader" size={32} color={colors.primary} />
        </View>
      </View>
    );
  }

  const bannerImage = subImageKey ? SUB_IMAGE_MAP[subImageKey] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("order.new")} showBack onBack={handleBack} />

      {/* Service preview banner */}
      {bannerImage && (
        <ImageBackground
          source={bannerImage}
          style={styles.banner}
          resizeMode="cover"
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.62)"]}
            style={styles.bannerGradient}
          >
            <Text style={styles.bannerLabel} numberOfLines={2}>
              {subCategory}
            </Text>
          </LinearGradient>
        </ImageBackground>
      )}

      {/* Step indicator */}
      <View style={[styles.stepsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {stepLabels.map((label, idx) => (
          <View key={idx} style={[styles.stepItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.stepDot, { backgroundColor: idx + 1 <= step ? colors.primary : colors.border }]}>
              {idx + 1 < step
                ? <VectorIcon name="check" size={12} color="#FFF" />
                : <Text style={{ color: idx + 1 <= step ? "#FFF" : colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{idx + 1}</Text>
              }
            </View>
            <Text
              style={{ color: idx + 1 <= step ? colors.primary : colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }}
              numberOfLines={1}
            >
              {label}
            </Text>
            {idx < stepLabels.length - 1 && (
              <View style={[styles.stepConnector, { backgroundColor: idx + 1 < step ? colors.primary : colors.border }]} />
            )}
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>

        <View style={[styles.navBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {step > 1 && (
            <FanniButton
              title={t("common.back")} onPress={handleBack}
              variant="outline"
              style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
            />
          )}
          {step < 3
            ? <FanniButton title={t("common.next")} onPress={handleNext} style={{ flex: 1 }} />
            : isAuthenticated
              ? <FanniButton title={t("common.sendOrder")} onPress={handleSubmit} loading={loading} style={{ flex: 1 }} />
              : <FanniButton
                  title={isRTL ? "تسجيل الدخول للإرسال" : "Log In to Submit"}
                  onPress={handleLoginToSubmit}
                  style={{ flex: 1 }}
                />
          }
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner:         { width: "100%", height: 160 },
  bannerGradient: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 18, paddingBottom: 14 },
  bannerLabel:    { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 18 },
  stepsRow: { paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "space-between" },
  stepItem: { flex: 1, alignItems: "center" },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepConnector: { flex: 1, height: 2, marginHorizontal: 4 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  card: { padding: 20, shadowColor: "#0D1B2A", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3, marginBottom: 16 },
  categoryBadge: { padding: 10, marginBottom: 16, alignSelf: "flex-start", alignItems: "center" },
  uploadLabel: { fontSize: 14, marginBottom: 10 },
  photosRow: { gap: 10, marginBottom: 12 },
  photoBox: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed" },
  row: { gap: 0 },
  egyptBadge: { padding: 12, borderWidth: 1.5, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  scheduleHeader: { alignItems: "center", marginTop: 8, marginBottom: 4 },
  scheduleIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  confirmHeader: { alignItems: "center", marginBottom: 20 },
  confirmIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  confirmRow: { paddingVertical: 10, borderBottomWidth: 1, alignItems: "center", flexDirection: "row" },
  totalRow: { padding: 14, borderWidth: 1.5, marginTop: 16, flexDirection: "row", alignItems: "center" },
  loginNotice: { padding: 12, marginTop: 14, flexDirection: "row", alignItems: "center" },
  navBtns: { gap: 8, marginBottom: 8 },
  authGate: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
});
