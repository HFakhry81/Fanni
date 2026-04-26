import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import Toast from "@/components/Toast";
import PasswordStrengthBar, { getPasswordStrength } from "@/components/PasswordStrengthBar";
import { uploadPhotoToServer } from "@/utils/uploadPhoto";
import { useSaveProfile } from "@/hooks/useSaveProfile";

const AUTH_TOKEN_KEY = "fanni_auth_token";

function getApiBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

export default function AdminProfileScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const colors = useColors();
  const { t, isRTL, user, setUser, setLanguage, language } = useApp();
  const { logout, refreshUser, sessionToken } = useAuth();
  const { saveProfile } = useSaveProfile();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastAction, setToastAction] = useState<{ label: string; onPress: () => void } | undefined>(undefined);
  const undoAvatarRef = useRef<string | undefined>(undefined);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [changePwMode, setChangePwMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePwErrors, setChangePwErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>({});
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (mode === "change-password" && !changePwMode) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePwErrors({});
      setChangePwMode(true);
    }
  }, [mode]);

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
      const result = await saveProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        email: email.trim() || null,
      });

      if (!result.ok) {
        throw new Error(result.error ?? t("profile.saveFailed"));
      }

      setEditMode(false);
      setToastMessage(t("profile.saveSuccess"));
      setToastVisible(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(
        t("common.error"),
        msg || t("profile.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const openChangePw = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangePwErrors({});
    setChangePwMode(true);
  };

  const cancelChangePw = () => {
    setChangePwMode(false);
    setChangePwErrors({});
  };

  const handleChangePassword = async () => {
    const errs: typeof changePwErrors = {};
    if (!currentPassword) errs.currentPassword = isRTL ? "مطلوب" : "Required";
    const pwStrength = getPasswordStrength(newPassword, isRTL);
    if (!newPassword || !pwStrength.isStrong)
      errs.newPassword = isRTL ? "كلمة المرور ضعيفة — استوفِ جميع المتطلبات" : "Password is too weak — meet all requirements";
    if (newPassword !== confirmPassword)
      errs.confirmPassword = isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match";
    if (Object.keys(errs).length > 0) {
      setChangePwErrors(errs);
      return;
    }
    setChangingPw(true);
    try {
      const apiBase = getApiBaseUrl();
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (!apiBase || !token) throw new Error(t("profile.noServer"));
      const res = await fetch(`${apiBase}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setChangePwErrors({ currentPassword: t("profile.wrongCurrentPassword") });
        } else {
          throw new Error(data.error ?? t("profile.saveFailed"));
        }
        return;
      }
      await refreshUser();
      setChangePwMode(false);
      setToastMessage(t("profile.passwordUpdated"));
      setToastVisible(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage(msg || t("profile.saveFailed"));
      setToastAction(undefined);
      setToastVisible(true);
    } finally {
      setChangingPw(false);
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

  const avatarUri: string | null = (user as { avatar?: string | null })?.avatar ?? null;

  const doPickPhoto = async () => {
    if (!sessionToken) {
      setToastMessage(isRTL ? "يجب تسجيل الدخول لرفع الصورة" : "Sign in required to upload photo");
      setToastAction(undefined);
      setToastVisible(true);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    setToastMessage(isRTL ? "جاري رفع الصورة..." : "Uploading photo...");
    setToastAction(undefined);
    setToastVisible(true);
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const { url } = await uploadPhotoToServer(asset.uri, sessionToken, mimeType);
      const apiBase = getApiBaseUrl();
      if (apiBase) {
        const patchRes = await fetch(`${apiBase}/api/auth/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ profileImageUrl: url }),
        });
        if (!patchRes.ok) throw new Error(`Server update failed: ${patchRes.status}`);
      }
      if (user) await setUser({ ...user, avatar: url });
      refreshUser().catch(() => {});
      setToastMessage(isRTL ? "تم تحديث صورة الملف الشخصي" : "Profile photo updated");
    } catch (_) {
      setToastMessage(isRTL ? "فشل رفع الصورة، يرجى المحاولة مرة أخرى" : "Upload failed, please try again");
    } finally {
      setAvatarUploading(false);
      setToastVisible(true);
    }
  };

  const pickAdminPhoto = () => {
    const hasPhoto = !!avatarUri;
    const buttons: Array<{ text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }> = [
      { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
      { text: isRTL ? "اختيار صورة" : "Choose Photo", onPress: doPickPhoto },
    ];
    if (hasPhoto) {
      buttons.push({
        text: isRTL ? "حذف الصورة" : "Remove Photo",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            isRTL ? "حذف الصورة" : "Remove Photo",
            isRTL ? "هل أنت متأكد أنك تريد حذف صورتك الشخصية؟" : "Are you sure you want to remove your photo?",
            [
              { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
              {
                text: isRTL ? "حذف" : "Remove",
                style: "destructive",
                onPress: async () => {
                  if (user) {
                    const previousAvatar = (user as { avatar?: string | null }).avatar ?? undefined;
                    undoAvatarRef.current = previousAvatar;
                    await setUser({ ...user, avatar: undefined });
                    const apiBase = getApiBaseUrl();
                    if (!apiBase || !sessionToken) {
                      await setUser({ ...user, avatar: previousAvatar });
                      undoAvatarRef.current = undefined;
                      setToastMessage(isRTL ? "يجب تسجيل الدخول لحذف الصورة" : "Sign in required to remove photo");
                      setToastAction(undefined);
                      setToastVisible(true);
                      return;
                    }
                    try {
                      const res = await fetch(`${apiBase}/api/auth/me`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
                        body: JSON.stringify({ profileImageUrl: null }),
                      });
                      if (!res.ok) throw new Error(`Server error: ${res.status}`);
                    } catch {
                      await setUser({ ...user, avatar: previousAvatar });
                      undoAvatarRef.current = undefined;
                      setToastMessage(isRTL ? "فشل حذف الصورة، يرجى المحاولة مرة أخرى" : "Failed to remove photo, please try again");
                      setToastAction(undefined);
                      setToastVisible(true);
                      return;
                    }
                    setToastMessage(isRTL ? "تم حذف صورة الملف الشخصي" : "Profile photo removed");
                    setToastAction({
                      label: isRTL ? "تراجع" : "Undo",
                      onPress: async () => {
                        if (user && undoAvatarRef.current !== undefined) {
                          const restoredAvatar = undoAvatarRef.current;
                          await setUser({ ...user, avatar: restoredAvatar });
                          undoAvatarRef.current = undefined;
                          if (apiBase && sessionToken) {
                            try {
                              const res = await fetch(`${apiBase}/api/auth/me`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
                                body: JSON.stringify({ profileImageUrl: restoredAvatar ?? null }),
                              });
                              if (!res.ok) throw new Error(`Server error: ${res.status}`);
                            } catch {
                              await setUser({ ...user, avatar: undefined });
                              setToastMessage(isRTL ? "فشل استعادة الصورة، يرجى المحاولة مرة أخرى" : "Failed to restore photo, please try again");
                              setToastAction(undefined);
                              setToastVisible(true);
                            }
                          }
                        }
                      },
                    });
                    setToastVisible(true);
                  }
                },
              },
            ]
          );
        },
      });
    }
    Alert.alert(
      isRTL ? "صورة الملف الشخصي" : "Profile Photo",
      undefined,
      buttons
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t("admin.profile")} showHome showLangToggle onBack={() => router.replace("/(admin)/(tabs)/dashboard")} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Avatar hero */}
        <View style={[styles.hero, { backgroundColor: colors.darkMid }]}>
          <TouchableOpacity onPress={pickAdminPhoto} disabled={avatarUploading} style={[styles.avatarRing, { borderColor: colors.primary }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[styles.avatar, { borderRadius: 40 }]} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                {avatarUploading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
            )}
            <View style={{ position: "absolute", bottom: 2, right: 2, backgroundColor: colors.primary, borderRadius: 10, padding: 3 }}>
              <VectorIcon name="camera" size={10} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.heroName}>{user?.name ?? ""}</Text>
          <View style={[styles.roleBadge, { backgroundColor: "rgba(245,166,35,0.2)", borderColor: colors.primary }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {t("profile.adminRole")}
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
                {t("profile.mobileReadOnly")}
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
                title={saving ? t("profile.saving") : t("common.save")}
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

        {/* Change Password */}
        {changePwMode ? (
          <View style={[styles.editSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
              {t("profile.changePassword")}
            </Text>
            <FanniInput
              label={t("profile.currentPassword")}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              error={changePwErrors.currentPassword}
              required
            />
            <FanniInput
              label={t("profile.newPassword")}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              error={changePwErrors.newPassword}
              required
            />
            {!!newPassword && <PasswordStrengthBar password={newPassword} />}
            <FanniInput
              label={t("profile.confirmPassword")}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={changePwErrors.confirmPassword}
              required
            />
            <View style={[styles.btnRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <FanniButton
                title={t("common.cancel")}
                onPress={cancelChangePw}
                variant="outline"
                style={{ flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
              />
              <FanniButton
                title={changingPw ? t("profile.passwordChanging") : t("common.save")}
                onPress={handleChangePassword}
                loading={changingPw}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.changePwBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
            onPress={openChangePw}
            activeOpacity={0.8}
          >
            <View style={[styles.changePwIcon, { backgroundColor: colors.accentBlue ?? "#EBF5FF", borderRadius: 10 }]}>
              <VectorIcon name="lock" size={20} color={colors.secondary ?? "#3B82F6"} />
            </View>
            <Text style={[styles.changePwText, { color: colors.foreground, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }]}>
              {t("profile.changePassword")}
            </Text>
            <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
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
        duration={toastAction ? 4000 : 2000}
        onHide={() => { setToastVisible(false); setToastAction(undefined); }}
        action={toastAction}
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

  changePwBtn: {
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
  },
  changePwIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  changePwText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    flex: 1,
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
