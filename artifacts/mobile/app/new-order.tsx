import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import LocationPicker from "@/components/LocationPicker";
import AppHeader from "@/components/AppHeader";
import { DEFAULT_GOVERNORATE, EGYPT_LOCATIONS, getAreas, getNeighborhoods } from "@/constants/egyptLocations";

type OrderStep = 1 | 2 | 3;

export default function NewOrderScreen() {
  const { category = "", subCategory = "" } = useLocalSearchParams<{ category: string; subCategory: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { addOrder } = useOrders();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<OrderStep>(1);
  const [loading, setLoading] = useState(false);

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  const [problemDesc, setProblemDesc] = useState("");
  const [deviceType, setDeviceType] = useState("");

  // ── Step 2 – Location ───────────────────────────────────────────────────────
  const [governorateId, setGovernorateId] = useState(DEFAULT_GOVERNORATE);
  const [areaId, setAreaId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [landmark, setLandmark] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const stepLabels = [t("order.describe"), t("order.schedule"), t("order.confirm")];

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

    const gov = EGYPT_LOCATIONS.find((g) => g.id === governorateId);
    const area = getAreas(governorateId).find((a) => a.id === areaId);
    const nbh  = getNeighborhoods(governorateId, areaId).find((n) => n.id === neighborhoodId);

    const fullAddress = [
      gov  ? (isRTL ? gov.ar  : gov.en)  : "",
      area ? (isRTL ? area.ar : area.en) : "",
      nbh  ? (isRTL ? nbh.ar  : nbh.en)  : "",
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
      photos: [],
      street: fullAddress,
      building, floor, apartment, landmark,
      visitDate, visitTime,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };

    await addOrder(newOrder);

    const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
    if (domain) {
      try {
        const res = await fetch(`https://${domain}/api/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newOrder),
        });
        if (!res.ok) {
          console.warn("[Fanni] Failed to broadcast order to server:", res.status);
        }
      } catch (err) {
        console.warn("[Fanni] Could not reach order notification server:", err);
      }
    }

    setLoading(false);
    router.replace("/(client)/orders");
  };

  // ── Step 1: Describe ────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View>
      <View style={[styles.categoryBadge, { backgroundColor: colors.accent, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Feather name="tag" size={14} color={colors.primary} />
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
        {[0, 1, 2, 3].map((i) => (
          <TouchableOpacity
            key={i}
            style={[styles.photoBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted }]}
          >
            <Feather name="plus" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
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
        neighborhoodId={neighborhoodId}
        onGovernorateChange={setGovernorateId}
        onAreaChange={setAreaId}
        onNeighborhoodChange={setNeighborhoodId}
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

      <FanniInput
        label={isRTL ? "علامة مميزة" : "Landmark"}
        value={landmark} onChangeText={setLandmark}
        placeholder={isRTL ? "مثال: بجانب مسجد..." : "e.g. Near the mosque..."}
      />

      {/* Schedule */}
      <View style={[styles.scheduleHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.scheduleIcon, { backgroundColor: colors.accentBlue }]}>
          <Feather name="calendar" size={16} color={colors.secondary} />
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
    const gov  = EGYPT_LOCATIONS.find((g) => g.id === governorateId);
    const area = getAreas(governorateId).find((a) => a.id === areaId);
    const nbh  = getNeighborhoods(governorateId, areaId).find((n) => n.id === neighborhoodId);

    const rows = [
      { label: isRTL ? "نوع الخدمة" : "Service",     value: `${t(`cat.${category}`)} — ${subCategory}` },
      { label: t("order.problemDesc"),                 value: problemDesc || "—" },
      { label: t("order.deviceType"),                  value: deviceType || "—" },
      { label: isRTL ? "المحافظة" : "Governorate",    value: gov  ? (isRTL ? gov.ar  : gov.en)  : "—" },
      { label: isRTL ? "المنطقة" : "Area",            value: area ? (isRTL ? area.ar : area.en) : "—" },
      { label: isRTL ? "الحي" : "Neighborhood",       value: nbh  ? (isRTL ? nbh.ar  : nbh.en)  : "—" },
      { label: isRTL ? "الشارع" : "Street",           value: street || "—" },
      { label: t("order.visitDate"),                   value: visitDate || "—" },
      { label: t("order.visitTime"),                   value: visitTime || "—" },
    ];

    return (
      <View>
        <View style={[styles.confirmHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.confirmIcon, { backgroundColor: colors.accent }]}>
            <Feather name="check-circle" size={22} color={colors.primary} />
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
          <Feather name="dollar-sign" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: 8 }}>
            {isRTL ? "سيتم تحديد السعر بعد الكشف" : "Price will be set after inspection"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("order.new")} showBack onBack={handleBack} />

      {/* Step indicator */}
      <View style={[styles.stepsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {stepLabels.map((label, idx) => (
          <View key={idx} style={[styles.stepItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.stepDot, { backgroundColor: idx + 1 <= step ? colors.primary : colors.border }]}>
              {idx + 1 < step
                ? <Feather name="check" size={12} color="#FFF" />
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
            : <FanniButton title={t("common.sendOrder")} onPress={handleSubmit} loading={loading} style={{ flex: 1 }} />
          }
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  navBtns: { gap: 8, marginBottom: 8 },
});
