import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";

const MOCK_USERS = [
  { mobile: "01012345678", password: "123456", type: "client" as const, name: "أحمد محمد", email: "ahmed@email.com", address: "القاهرة، مصر", id: "client1" },
  { mobile: "01098765432", password: "123456", type: "technician" as const, name: "محمد علي", email: "tech@email.com", address: "الجيزة، مصر", id: "tech1", profession: "كهرباء", specialty: "تكييف", experience: 5 },
  { mobile: "admin", password: "admin", type: "admin" as const, name: "مسئول النظام", email: "admin@fanni.com", address: "", id: "admin1" },
];

export default function LoginScreen() {
  const { type = "client" } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, setUser, setUserType } = useApp();
  const insets = useSafeAreaInsets();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
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
      });
      if (found.type === "client") router.replace("/(client)/home");
      else if (found.type === "technician") router.replace("/(tech)/map");
      else router.replace("/(admin)/dashboard");
    } else {
      setLoading(false);
      setErrors({ general: isRTL ? "بيانات غير صحيحة، تحقق من رقم الموبايل وكلمة المرور" : "Invalid credentials, please check your mobile and password" });
    }
    setLoading(false);
  };

  const typeLabels: Record<string, { ar: string; en: string }> = {
    client: { ar: "عميل", en: "Client" },
    technician: { ar: "فني", en: "Technician" },
    admin: { ar: "مسئول نظام", en: "Admin" },
  };

  const typeLabel = isRTL ? typeLabels[type]?.ar : typeLabels[type]?.en;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.dark,
            paddingTop: topPad + 12,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { [isRTL ? "right" : "left"]: 16 }]}
          onPress={() => router.back()}
        >
          <Feather
            name={isRTL ? "arrow-right" : "arrow-left"}
            size={22}
            color="#FFF"
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: "#FFF", fontFamily: "Inter_700Bold" },
          ]}
        >
          {t("login.title")} — {typeLabel}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderRadius: colors.radius * 1.5 },
          ]}
        >
          {errors.general && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: "#FFE6E6", borderRadius: colors.radius },
              ]}
            >
              <Text
                style={{
                  color: colors.destructive,
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {errors.general}
              </Text>
            </View>
          )}

          <FanniInput
            label={type === "admin" ? "Username" : t("login.mobile")}
            placeholder={
              type === "admin"
                ? "admin"
                : isRTL
                ? "01XXXXXXXXX"
                : "01XXXXXXXXX"
            }
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
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

          <TouchableOpacity style={styles.forgotRow} onPress={() => {}}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: "Inter_500Medium",
                fontSize: 13,
              }}
            >
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
          <View
            style={[
              styles.registerRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
              }}
            >
              {t("login.noAccount")}{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                }}
              >
                {t("login.register")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {type === "client" && (
          <View style={styles.hint}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              {isRTL ? "للتجربة: موبايل 01012345678 | كلمة مرور 123456" : "Demo: mobile 01012345678 | password 123456"}
            </Text>
          </View>
        )}
        {type === "technician" && (
          <View style={styles.hint}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              {isRTL ? "للتجربة: موبايل 01098765432 | كلمة مرور 123456" : "Demo: mobile 01098765432 | password 123456"}
            </Text>
          </View>
        )}
        {type === "admin" && (
          <View style={styles.hint}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              {isRTL ? "للتجربة: admin | admin" : "Demo: admin | admin"}
            </Text>
          </View>
        )}
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
  scroll: { flex: 1 },
  content: { padding: 20 },
  card: {
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  errorBox: { padding: 12, marginBottom: 12 },
  forgotRow: { alignItems: "flex-end", marginBottom: 16 },
  registerRow: { justifyContent: "center", alignItems: "center", marginBottom: 8 },
  hint: { marginTop: 8 },
});
