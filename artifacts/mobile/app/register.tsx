import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";

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

  // Personal info
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Account info
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");

  // Technician fields
  const [profession, setProfession] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [experience, setExperience] = useState("");

  // Location
  const [governorate, setGovernorate] = useState("");
  const [area, setArea] = useState("");
  const [district, setDistrict] = useState("");
  const [serviceStart, setServiceStart] = useState("08:00");
  const [serviceEnd, setServiceEnd] = useState("20:00");

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const totalSteps = regType === "client" ? 2 : 3;

  const progressColor = (s: number) =>
    s <= step ? colors.primary : colors.border;

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 1000));
      setLoading(false);
      router.push("/register-success");
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const paymentOptions = [
    { id: "bank" as PaymentMethod, label: t("register.bankAccount") },
    { id: "ewallet" as PaymentMethod, label: t("register.eWallet") },
    { id: "instapay" as PaymentMethod, label: t("register.instaPay") },
  ];

  const renderStepIndicator = () => (
    <View style={[styles.stepRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
        <React.Fragment key={s}>
          <View
            style={[
              styles.stepCircle,
              {
                backgroundColor: s <= step ? colors.primary : colors.muted,
                borderColor: s <= step ? colors.primary : colors.border,
              },
            ]}
          >
            {s < step ? (
              <Feather name="check" size={14} color="#FFF" />
            ) : (
              <Text
                style={{
                  color: s <= step ? "#FFF" : colors.mutedForeground,
                  fontSize: 12,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {s}
              </Text>
            )}
          </View>
          {s < totalSteps && (
            <View
              style={[
                styles.stepLine,
                { backgroundColor: s < step ? colors.primary : colors.border },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
        {t("register.step1")}
      </Text>
      <FanniInput label={t("register.name")} value={name} onChangeText={setName} required placeholder={isRTL ? "الاسم الكامل" : "Full name"} />
      {regType === "technician" && (
        <FanniInput label={t("register.age")} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="25" />
      )}
      <FanniInput label={t("register.mobile")} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" required placeholder="01XXXXXXXXX" />
      <FanniInput label={t("register.email")} value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="email@example.com" />
      <FanniInput label={t("register.address")} value={address} onChangeText={setAddress} required placeholder={isRTL ? "العنوان" : "Address"} />

      {regType === "technician" && (
        <View
          style={[
            styles.uploadBox,
            { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted },
          ]}
        >
          <Feather name="camera" size={24} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8 }}>
            {t("register.idPhoto")}
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep2Client = () => (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
        {t("register.step2")}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
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
          <View
            style={[
              styles.radio,
              {
                borderColor: paymentMethod === opt.id ? colors.primary : colors.border,
                backgroundColor: paymentMethod === opt.id ? colors.primary : "transparent",
              },
            ]}
          />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep2Tech = () => (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
        {isRTL ? "بيانات المهنة" : "Profession Info"}
      </Text>
      <FanniInput label={t("register.profession")} value={profession} onChangeText={setProfession} required placeholder={isRTL ? "مثال: كهرباء، سباكة" : "e.g. Electrician, Plumber"} />
      <FanniInput label={t("register.specialty")} value={specialty} onChangeText={setSpecialty} required placeholder={isRTL ? "مثال: تكييف، سخانات" : "e.g. AC, Heaters"} />
      <FanniInput label={t("register.experience")} value={experience} onChangeText={setExperience} keyboardType="numeric" required placeholder="5" />
      <View style={[styles.uploadBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted }]}>
        <Feather name="image" size={24} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8 }}>
          {t("register.workPhotos")} (5 {isRTL ? "صور" : "photos"})
        </Text>
      </View>
      <View style={[styles.uploadBox, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted, marginTop: 12 }]}>
        <Feather name="award" size={24} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8 }}>
          {t("register.licensePhoto")}
        </Text>
      </View>
    </View>
  );

  const renderStep3Tech = () => (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
        {t("register.step3")}
      </Text>
      <FanniInput label={t("register.governorate")} value={governorate} onChangeText={setGovernorate} required placeholder={isRTL ? "مثال: القاهرة" : "e.g. Cairo"} />
      <FanniInput label={t("register.area")} value={area} onChangeText={setArea} placeholder={isRTL ? "مثال: مدينة نصر" : "e.g. Nasr City"} />
      <FanniInput label={t("register.district")} value={district} onChangeText={setDistrict} placeholder={isRTL ? "مثال: الحي الثامن" : "e.g. District 8"} />

      <View style={[styles.timeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}>
          <FanniInput label={t("register.serviceStart")} value={serviceStart} onChangeText={setServiceStart} placeholder="08:00" />
        </View>
        <View style={{ flex: 1 }}>
          <FanniInput label={t("register.serviceEnd")} value={serviceEnd} onChangeText={setServiceEnd} placeholder="20:00" />
        </View>
      </View>

      <View
        style={[
          styles.mapPlaceholder,
          { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted },
        ]}
      >
        <Feather name="map-pin" size={30} color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8, textAlign: "center" }}>
          {isRTL ? "اضغط لتحديد نطاق الخدمة على الخريطة" : "Tap to set service area on map"}
        </Text>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    if (regType === "client") {
      if (step === 1) return renderStep1();
      if (step === 2) return renderStep2Client();
    } else {
      if (step === 1) return renderStep1();
      if (step === 2) return renderStep2Tech();
      if (step === 3) return renderStep3Tech();
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 12 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { [isRTL ? "right" : "left"]: 16 }]}
          onPress={handleBack}
        >
          <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("register.title")}
        </Text>
      </View>

      {/* Type Selector */}
      <View style={[styles.typeRow, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {(["client", "technician"] as RegisterType[]).map((rt) => (
          <TouchableOpacity
            key={rt}
            style={[
              styles.typeBtn,
              {
                backgroundColor: regType === rt ? colors.primary : "transparent",
                borderRadius: colors.radius,
              },
            ]}
            onPress={() => { setRegType(rt); setStep(1); }}
          >
            <Text
              style={{
                color: regType === rt ? "#FFF" : colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
              }}
            >
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

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 },
          ]}
        >
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
  header: {
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    bottom: 20,
    padding: 4,
  },
  headerTitle: { fontSize: 18 },
  typeRow: {
    flexDirection: "row",
    margin: 16,
    padding: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  stepRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { flex: 1, height: 2, maxWidth: 60 },
  stepTitle: { fontSize: 18, marginBottom: 20 },
  card: {
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  optionRow: {
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  timeRow: { gap: 0 },
  mapPlaceholder: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  navBtns: { gap: 8, marginBottom: 8 },
});
