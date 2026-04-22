import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";

const MOCK_USERS = [
  {
    mobile: "01012345678",
    password: "123456",
    type: "client" as const,
    name: "أحمد محمد السيد",
    email: "ahmed@email.com",
    address: "الإسكندرية، سموحة",
    id: "client1",
    governorate: "alexandria",
    area: "alex_east",
    district: "smouha",
  },
  {
    mobile: "01098765432",
    password: "123456",
    type: "technician" as const,
    name: "محمد علي حسن",
    email: "tech@email.com",
    address: "الإسكندرية، فلمنج",
    id: "tech1",
    profession: "كهرباء",
    specialty: "تكييف",
    experience: 5,
    governorate: "alexandria",
    area: "alex_east",
    district: "fleming",
  },
  {
    mobile: "01000000000",
    password: "admin123",
    type: "admin" as const,
    name: "مسئول النظام",
    email: "admin@fanni.com",
    address: "",
    id: "admin1",
  },
  // Short demo credentials (keep for backward compat)
  {
    mobile: "123",
    password: "123",
    type: "client" as const,
    name: "أحمد محمد السيد",
    email: "ahmed@email.com",
    address: "الإسكندرية، سموحة",
    id: "client1",
    governorate: "alexandria",
    area: "alex_east",
    district: "smouha",
  },
  {
    mobile: "111",
    password: "1",
    type: "technician" as const,
    name: "محمد علي حسن",
    email: "tech@email.com",
    address: "الإسكندرية، فلمنج",
    id: "tech1",
    profession: "كهرباء",
    specialty: "تكييف",
    experience: 5,
    governorate: "alexandria",
    area: "alex_east",
    district: "fleming",
  },
  {
    mobile: "111",
    password: "10",
    type: "admin" as const,
    name: "مسئول النظام",
    email: "admin@fanni.com",
    address: "",
    id: "admin1",
  },
];

export default function LoginScreen() {
  const { type = "client" } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, setUser } = useApp();
  const insets = useSafeAreaInsets();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!mobile.trim()) e.mobile = isRTL ? "رقم الموبايل مطلوب" : "Mobile required";
    if (!password.trim()) e.password = isRTL ? "كلمة المرور مطلوبة" : "Password required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const found = MOCK_USERS.find(
      (u) => u.mobile === mobile.trim() && u.password === password && u.type === type
    );
    if (found) {
      await setUser({
        id: found.id,
        type: found.type,
        name: found.name,
        mobile: found.mobile,
        email: found.email,
        address: found.address,
        profession: "profession" in found ? found.profession : undefined,
        specialty: "specialty" in found ? found.specialty : undefined,
        experience: "experience" in found ? found.experience : undefined,
        governorate: "governorate" in found ? (found as any).governorate : undefined,
        area: "area" in found ? (found as any).area : undefined,
        district: "district" in found ? (found as any).district : undefined,
      });
      if (found.type === "client") router.replace("/(client)/home");
      else if (found.type === "technician") router.replace("/(tech)/map");
      else router.replace("/(admin)/dashboard");
    } else {
      setLoading(false);
      setErrors({
        general: isRTL
          ? "بيانات غير صحيحة، تحقق من رقم الموبايل وكلمة المرور"
          : "Invalid credentials, check your mobile and password",
      });
    }
    setLoading(false);
  };

  const typeLabels: Record<string, { ar: string; en: string }> = {
    client: { ar: "عميل", en: "Client" },
    technician: { ar: "فني", en: "Technician" },
    admin: { ar: "مسئول نظام", en: "Admin" },
  };

  const typeLabel = isRTL ? typeLabels[type]?.ar : typeLabels[type]?.en;

  const demoInfo: Record<string, { mobile: string; password: string }> = {
    client:     { mobile: "01012345678", password: "123456" },
    technician: { mobile: "01098765432", password: "123456" },
    admin:      { mobile: "01000000000", password: "admin123" },
  };
  const demo = demoInfo[type] ?? demoInfo.client;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`${t("login.title")} — ${typeLabel}`}
        showBack
        onBack={() => router.back()}
        showLangToggle
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Demo hint card */}
        <View style={[styles.demoCard, { backgroundColor: colors.accentBlue, borderColor: colors.secondary, borderRadius: colors.radius }]}>
          <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 8 }]}>
            <Feather name="info" size={16} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
              {isRTL ? "بيانات التجربة" : "Demo Credentials"}
            </Text>
          </View>
          <Text style={{ color: colors.secondary, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 6, textAlign: isRTL ? "right" : "left" }}>
            {isRTL
              ? `📱 ${demo.mobile}   🔑 ${demo.password}`
              : `📱 ${demo.mobile}   🔑 ${demo.password}`}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 }]}>
          {errors.general && (
            <View style={[styles.errorBox, { backgroundColor: "#FFE6E6", borderRadius: colors.radius }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left", flex: 1, marginLeft: 6 }}>
                {errors.general}
              </Text>
            </View>
          )}

          <FanniInput
            label={isRTL ? "رقم الموبايل" : "Mobile Number"}
            placeholder={isRTL ? "01XXXXXXXXX" : "01XXXXXXXXX"}
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            autoCapitalize="none"
            error={errors.mobile}
            required
          />

          <FanniInput
            label={t("login.password")}
            placeholder={isRTL ? "كلمة المرور" : "Password"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
            required
          />

          <TouchableOpacity style={[styles.forgotRow, { alignItems: isRTL ? "flex-start" : "flex-end" }]} onPress={() => {}}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {t("login.forgot")}
            </Text>
          </TouchableOpacity>

          <FanniButton
            title={t("login.submit")}
            onPress={handleLogin}
            loading={loading}
            fullWidth
            style={{ marginTop: 8 }}
          />
        </View>

        {type !== "admin" && (
          <View style={[styles.registerRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }}>
              {t("login.noAccount")}{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                {t("login.register")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16 },
  demoCard: {
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 14,
  },
  card: {
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  errorBox: { padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center" },
  forgotRow: { marginBottom: 16 },
  registerRow: { justifyContent: "center", alignItems: "center" },
});
