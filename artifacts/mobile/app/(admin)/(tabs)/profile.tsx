import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import Toast from "@/components/Toast";

const AUTH_TOKEN_KEY = "fanni_auth_token";

function getApiBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

export default function AdminProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language } = useApp();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ firstName?: string; email?: string }>({});

  const openEdit = () => {
    if (!user) return;
    const nameParts = (user.name ?? "").split(/\s+/);
    setFirstName(nameParts[0] ?? "");
    setLastName(nameParts.slice(1).join(" ") ?? "");
    setEmail(user.email ?? "");
    setErrors({});
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setErrors({});
  };

  const handleSave = async () => {
    if (!user) return;
    const newErrors: typeof errors = {};

    if (!firstName.trim()) {
      newErrors.firstName = isRTL ? "الاسم الأول مطلوب" : "First name is required";
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = isRTL ? "البريد الإلكتروني غير صحيح" : "Invalid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const apiBase = getApiBaseUrl();
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (apiBase && token) {
        const res = await fetch(`${apiBase}/api/auth/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim() || null,
            email: email.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to save");
        }
      }

      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      await setUser({
        ...user,
        name: fullName,
        email: email.trim() || user.email,
      });

      setEditMode(false);
      setToastMessage(t("profile.saveSuccess"));
      setToastVisible(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        msg || (isRTL ? "حدث خطأ أثناء الحفظ" : "Failed to save changes")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t("profile.logout"),
      t("profile.logoutConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.logout"),
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/welcome");
          },
        },
      ]
    );
  };

  const initials = (user?.name ?? "A")
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("admin.profile")} showHome showLangToggle onBack={() => router.replace("/(admin)/(tabs)/dashboard")} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Avatar hero */}
        <View style={[styles.hero, { backgroundColor: colors.darkMid }]}>
          <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{user?.name ?? ""}</Text>
          <View style={[styles.roleBadge, { backgroundColor: "rgba(245,166,35,0.2)", borderColor: colors.primary }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {isRTL ? "مسئول النظام" : "System Admin"}
            </Text>
          </View>
          {user?.email ? (
            <Text style={styles.heroEmail}>{user.email}</Text>
          ) : null}
          <Text style={styles.heroMobile}>{user?.mobile ?? ""}</Text>
        </View>

        {/* Language toggle */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={[styles.cardLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left", flex: 1 }]}>
            {t("profile.language")}
          </Text>
          <View style={[styles.langToggle, { backgroundColor: colors.muted, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {(["ar", "en"] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.langOption, { backgroundColor: language === lang ? colors.primary : "transparent" }]}
                onPress={() => setLanguage(lang)}
              >
                <Text style={{ color: language === lang ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {lang === "ar" ? "العربية" : "English"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Edit form or info card */}
        {editMode ? (
          <View style={[styles.editSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
              {t("profile.edit")}
            </Text>

            <FanniInput
              label={t("profile.firstName")}
              value={firstName}
              onChangeText={setFirstName}
              error={errors.firstName}
              required
              autoCapitalize="words"
            />
            <FanniInput
              label={t("profile.lastName")}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            <FanniInput
              label={t("register.email")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            {/* Mobile — read-only */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                {t("register.mobile")}
              </Text>
              <View style={[styles.readOnlyField, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
                  {user?.mobile ?? ""}
                </Text>
              </View>
              <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "رقم الجوال لا يمكن تغييره" : "Mobile number cannot be changed"}
              </Text>
            </View>

            <View style={[styles.btnRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <FanniButton
                title={t("common.cancel")}
                onPress={cancelEdit}
                variant="outline"
                style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
              />
              <FanniButton
                title={saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : t("common.save")}
                onPress={handleSave}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.infoSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{t("profile.firstName")}</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {(user?.name ?? "").split(/\s+/)[0] ?? ""}
              </Text>
            </View>
            <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{t("profile.lastName")}</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {(user?.name ?? "").split(/\s+/).slice(1).join(" ") || "—"}
              </Text>
            </View>
            <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{t("register.email")}</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{user?.email || "—"}</Text>
            </View>
            <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomWidth: 0 }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{t("register.mobile")}</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{user?.mobile ?? ""}</Text>
            </View>

            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={openEdit}
              activeOpacity={0.8}
            >
              <Text style={styles.editBtnText}>{t("profile.edit")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: "#FFCCCC", borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <View style={[styles.logoutIcon, { backgroundColor: "#FFE6E6", borderRadius: 10 }]}>
            <Text style={{ fontSize: 20 }}>⏻</Text>
          </View>
          <Text style={[styles.logoutText, { color: colors.destructive, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }]}>
            {t("profile.logout")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

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
  content: { padding: 16, gap: 14 },

  hero: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 4,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    padding: 3,
    marginBottom: 12,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFF",
    fontFamily: "Inter_700Bold",
    fontSize: 30,
  },
  heroName: {
    color: "#FFF",
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 8,
  },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  roleText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  heroEmail: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  heroMobile: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },

  card: {
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  cardLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    marginRight: 8,
  },
  langToggle: {
    borderRadius: 20,
    padding: 3,
    gap: 2,
  },
  langOption: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 16,
  },

  infoSection: {
    borderWidth: 1,
    overflow: "hidden",
  },
  infoRow: {
    padding: 14,
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  infoValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 8,
  },
  editBtn: {
    margin: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  editBtnText: {
    color: "#FFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },

  editSection: {
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginBottom: 6,
  },
  readOnlyField: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 4,
  },
  btnRow: {
    marginTop: 8,
    gap: 8,
  },

  logoutBtn: {
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  logoutIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    flex: 1,
  },
});
