import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import LocationPicker from "@/components/LocationPicker";
import AppHeader from "@/components/AppHeader";
import { DEFAULT_GOVERNORATE } from "@/constants/egyptLocations";

type RegisterType = "client" | "technician";
type PaymentMethod = "bank" | "ewallet" | "instapay";

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
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

  // ── Payment ────────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");
  const [bankAccount, setBankAccount] = useState("");

  // ── Technician Info ────────────────────────────────────────────────────────
  const [profession, setProfession] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [experience, setExperience] = useState("");

  // ── Location (shared) ──────────────────────────────────────────────────────
  const [governorateId, setGovernorateId] = useState(DEFAULT_GOVERNORATE);
  const [areaId, setAreaId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");

  // ── Technician service hours ───────────────────────────────────────────────
  const [serviceStart, setServiceStart] = useState("08:00");
  const [serviceEnd, setServiceEnd] = useState("22:00");

  // ── Validation errors ──────────────────────────────────────────────────────
  const [errors, setErrors] = useState<{
    name?: string;
    mobile?: string;
    nationalId?: string;
    area?: string;
  }>({});

  const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;
  const totalSteps = 3;

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

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      const mobileDigits = mobile.trim().replace(/\s|-/g, "");
      const mobileMatch = mobileDigits.match(EGYPT_MOBILE_RE);
      if (mobileMatch) setMobile(`0${mobileMatch[2]}`);

      setLoading(true);
      await new Promise((r) => setTimeout(r, 1000));
      setLoading(false);
      router.push("/register-success");
    }
  };

  const handleBack = () => {
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
              <Feather name="check" size={14} color="#FFF" />
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
          <Feather name="user" size={20} color={colors.primary} />
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
        onChangeText={(v) => { setMobile(v); setErrors((e) => ({ ...e, mobile: undefined })); }}
        keyboardType="phone-pad" required
        placeholder="01XXXXXXXXX"
        error={errors.mobile}
      />
      <FanniInput label={t("register.email")} value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="email@example.com" />

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
          <Feather name="camera" size={24} color={colors.secondary} />
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
          <Feather name="credit-card" size={20} color={colors.secondary} />
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
            <Feather name={opt.icon as any} size={18} color={paymentMethod === opt.id ? colors.primary : colors.mutedForeground} />
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
  const renderStep2Tech = () => (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accent }]}>
          <Feather name="tool" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left", marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
          {isRTL ? "بيانات المهنة" : "Profession Info"}
        </Text>
      </View>

      <FanniInput label={t("register.profession")} value={profession} onChangeText={setProfession} required placeholder={isRTL ? "مثال: كهربائي، سباك" : "e.g. Electrician, Plumber"} />
      <FanniInput label={t("register.specialty")} value={specialty} onChangeText={setSpecialty} required placeholder={isRTL ? "مثال: تكييف، سخانات" : "e.g. AC, Water Heaters"} />
      <FanniInput label={`${t("register.experience")} (${isRTL ? "سنوات" : "years"})`} value={experience} onChangeText={setExperience} keyboardType="numeric" required placeholder="5" />

      <View style={[styles.timeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}>
          <FanniInput label={isRTL ? "بداية العمل" : "Work Start"} value={serviceStart} onChangeText={setServiceStart} placeholder="08:00" />
        </View>
        <View style={{ flex: 1 }}>
          <FanniInput label={isRTL ? "نهاية العمل" : "Work End"} value={serviceEnd} onChangeText={setServiceEnd} placeholder="22:00" />
        </View>
      </View>

      <TouchableOpacity style={[styles.uploadBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted }]}>
        <Feather name="image" size={24} color={colors.secondary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 8 }}>
          {t("register.workPhotos")} (5 {isRTL ? "صور" : "photos"})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.uploadBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted, marginTop: 10 }]}>
        <Feather name="award" size={24} color={colors.secondary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 8 }}>
          {t("register.licensePhoto")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Step 3 Client: Home address ───────────────────────────────────────────
  const renderStep3Client = () => (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accentBlue }]}>
          <Feather name="home" size={20} color={colors.secondary} />
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
        neighborhoodId={neighborhoodId}
        onGovernorateChange={setGovernorateId}
        onAreaChange={(id) => { setAreaId(id); if (id) setErrors((e) => ({ ...e, area: undefined })); }}
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
      {errors.area ? (
        <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: -8, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>
          {errors.area}
        </Text>
      ) : null}
    </View>
  );

  // ── Step 3 Tech: Location ──────────────────────────────────────────────────
  const renderStep3Tech = () => (
    <View>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.stepIcon, { backgroundColor: colors.accentBlue }]}>
          <Feather name="map-pin" size={20} color={colors.secondary} />
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
        neighborhoodId={neighborhoodId}
        onGovernorateChange={setGovernorateId}
        onAreaChange={(id) => { setAreaId(id); if (id) setErrors((e) => ({ ...e, area: undefined })); }}
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
      {errors.area ? (
        <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: -8, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>
          {errors.area}
        </Text>
      ) : null}
    </View>
  );

  const renderCurrentStep = () => {
    if (regType === "client") {
      if (step === 1) return renderStep1();
      if (step === 2) return renderStep2Client();
      if (step === 3) return renderStep3Client();
    } else {
      if (step === 1) return renderStep1();
      if (step === 2) return renderStep2Tech();
      if (step === 3) return renderStep3Tech();
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
            onPress={() => { setRegType(rt); setStep(1); setErrors({}); }}
          >
            <Feather name={rt === "client" ? "home" : "tool"} size={14} color={regType === rt ? "#FFF" : colors.mutedForeground} />
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
        {renderStepIndicator()}

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          {renderCurrentStep()}
        </View>

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
            style={{ flex: 1 }}
          />
        </View>
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
});
