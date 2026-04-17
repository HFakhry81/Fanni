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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";

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

  // Step 1 - Problem description
  const [problemDesc, setProblemDesc] = useState("");
  const [deviceType, setDeviceType] = useState("");

  // Step 2 - Location & schedule
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [landmark, setLandmark] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const stepLabels = [
    t("order.describe"),
    t("order.schedule"),
    t("order.confirm"),
  ];

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as OrderStep);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as OrderStep);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    const orderId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    await addOrder({
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
      street,
      building,
      floor,
      apartment,
      landmark,
      visitDate,
      visitTime,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    setLoading(false);
    router.replace("/(client)/orders");
  };

  const renderStep1 = () => (
    <View>
      <View
        style={[
          styles.categoryBadge,
          { backgroundColor: colors.accent, borderRadius: colors.radius },
        ]}
      >
        <Text
          style={{
            color: colors.primary,
            fontFamily: "Inter_600SemiBold",
            fontSize: 13,
          }}
        >
          {t(`cat.${category}`)} — {subCategory}
        </Text>
      </View>

      <FanniInput
        label={t("order.problemDesc")}
        value={problemDesc}
        onChangeText={setProblemDesc}
        multiline
        numberOfLines={4}
        placeholder={isRTL ? "اشرح المشكلة بالتفصيل..." : "Describe the problem in detail..."}
        required
      />
      <FanniInput
        label={t("order.deviceType")}
        value={deviceType}
        onChangeText={setDeviceType}
        placeholder={isRTL ? "مثال: مكيف سبليت 1.5 حصان" : "e.g. Split AC 1.5HP"}
      />

      <Text
        style={[
          styles.uploadLabel,
          {
            color: colors.foreground,
            fontFamily: "Inter_500Medium",
            textAlign: isRTL ? "right" : "left",
          },
        ]}
      >
        {t("order.photos")}
      </Text>
      <View style={[styles.photosRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {[0, 1, 2, 3].map((i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.photoBox,
              {
                borderColor: colors.border,
                borderRadius: colors.radius,
                backgroundColor: colors.muted,
              },
            ]}
          >
            <Feather name="plus" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View>
      <FanniInput label={t("order.street")} value={street} onChangeText={setStreet} required placeholder={isRTL ? "اسم الشارع" : "Street name"} />
      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <FanniInput label={t("order.building")} value={building} onChangeText={setBuilding} keyboardType="numeric" style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} placeholder="15" />
        <FanniInput label={t("order.floor")} value={floor} onChangeText={setFloor} keyboardType="numeric" style={{ flex: 1 }} placeholder="3" />
      </View>
      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <FanniInput label={t("order.apt")} value={apartment} onChangeText={setApartment} keyboardType="numeric" style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} placeholder="12" />
        <FanniInput label={t("order.landmark")} value={landmark} onChangeText={setLandmark} style={{ flex: 1 }} placeholder={isRTL ? "علامة مميزة" : "Landmark"} />
      </View>

      <View
        style={[
          styles.mapPlaceholder,
          { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.muted },
        ]}
      >
        <Feather name="map-pin" size={28} color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 8 }}>
          {t("common.getLocation")}
        </Text>
      </View>

      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <FanniInput label={t("order.visitDate")} value={visitDate} onChangeText={setVisitDate} placeholder="2024-01-25" style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
        <FanniInput label={t("order.visitTime")} value={visitTime} onChangeText={setVisitTime} placeholder="10:00" style={{ flex: 1 }} />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 20, textAlign: isRTL ? "right" : "left" }}>
        {t("order.confirm")}
      </Text>

      {[
        { label: isRTL ? "نوع الخدمة" : "Service", value: `${t(`cat.${category}`)} — ${subCategory}` },
        { label: t("order.problemDesc"), value: problemDesc || "—" },
        { label: t("order.deviceType"), value: deviceType || "—" },
        { label: t("order.street"), value: street || "—" },
        { label: t("order.visitDate"), value: visitDate || "—" },
        { label: t("order.visitTime"), value: visitTime || "—" },
      ].map((item) => (
        <View
          key={item.label}
          style={[
            styles.confirmRow,
            {
              borderBottomColor: colors.border,
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
        >
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 }}>
            {item.label}
          </Text>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 2, textAlign: isRTL ? "left" : "right" }}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 12 }]}>
        <TouchableOpacity style={[styles.backBtn, { [isRTL ? "right" : "left"]: 16 }]} onPress={handleBack}>
          <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>
          {t("order.new")}
        </Text>
      </View>

      {/* Step indicator */}
      <View style={[styles.stepsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {stepLabels.map((label, idx) => (
          <View key={idx} style={[styles.stepItem, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View
              style={[
                styles.stepDot,
                { backgroundColor: idx + 1 <= step ? colors.primary : colors.border },
              ]}
            >
              {idx + 1 < step ? (
                <Feather name="check" size={12} color="#FFF" />
              ) : (
                <Text style={{ color: idx + 1 <= step ? "#FFF" : colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                  {idx + 1}
                </Text>
              )}
            </View>
            <Text
              style={{
                color: idx + 1 <= step ? colors.primary : colors.mutedForeground,
                fontSize: 11,
                fontFamily: "Inter_500Medium",
                marginLeft: isRTL ? 0 : 4,
                marginRight: isRTL ? 4 : 0,
              }}
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
              title={t("common.back")}
              onPress={handleBack}
              variant="outline"
              style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
            />
          )}
          {step < 3 ? (
            <FanniButton
              title={t("common.next")}
              onPress={handleNext}
              style={{ flex: 1 }}
            />
          ) : (
            <FanniButton
              title={t("common.sendOrder")}
              onPress={handleSubmit}
              loading={loading}
              style={{ flex: 1 }}
            />
          )}
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
  backBtn: { position: "absolute", bottom: 20, padding: 4 },
  headerTitle: { fontSize: 18 },
  stepsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  categoryBadge: { padding: 10, marginBottom: 16, alignSelf: "flex-start" },
  uploadLabel: { fontSize: 14, marginBottom: 10 },
  photosRow: { gap: 10, marginBottom: 12 },
  photoBox: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  row: { gap: 0 },
  mapPlaceholder: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: "flex-start",
    gap: 8,
  },
  navBtns: { gap: 8, marginBottom: 8 },
});
