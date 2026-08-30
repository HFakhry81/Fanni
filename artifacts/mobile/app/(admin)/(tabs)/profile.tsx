import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import OtpVerifyModal from "@/components/OtpVerifyModal";
import KeyboardAwareScrollViewCompat from "@/components/KeyboardAwareScrollViewCompat";
import AppIdentityCard from "@/components/AppIdentityCard";
import { getApiBase } from "@/utils/api";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { getAuthToken } from "@/utils/authTokenStorage";
import { confirmDialog } from "@/utils/confirmDialog";

// ─── Payment Manager Picker ───────────────────────────────────────────────────
interface AdminOption { id: string; firstName: string | null; lastName: string | null; mobile: string | null }

function PaymentManagerPicker({ sessionToken, isRTL, colors }: {
  sessionToken: string | null | undefined;
  isRTL: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [currentManagerId, setCurrentManagerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const apiBase = getApiBase();
  const headers = { "Content-Type": "application/json", ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) };

  const load = useCallback(async () => {
    if (!apiBase || !sessionToken) return;
    const reqHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` };
    setLoading(true);
    try {
      const [cfgRes, listRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/payment-config`, { headers: reqHeaders }),
        fetch(`${apiBase}/api/admin/admins-list`, { headers: reqHeaders }),
      ]);
      const cfg = cfgRes.ok ? await cfgRes.json() as { config: { paymentManagerId?: string | null } } : null;
      const list = listRes.ok ? await listRes.json() as { admins: AdminOption[] } : null;
      if (cfg?.config) setCurrentManagerId(cfg.config.paymentManagerId ?? null);
      if (list?.admins) setAdmins(list.admins);
    } catch(_) { /* ignore */ }
    finally { setLoading(false); }
  }, [apiBase, sessionToken]);

  const pick = async (adminId: string | null) => {
    if (!apiBase || !sessionToken) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/payment-config`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ paymentManagerId: adminId ?? "" }),
      });
      if (res.ok) {
        setCurrentManagerId(adminId);
        setToastMsg(isRTL ? "تم حفظ مدير المدفوعات" : "Payment manager updated");
      } else {
        setToastMsg(isRTL ? "فشل الحفظ" : "Save failed");
      }
    } catch (_) { setToastMsg(isRTL ? "خطأ في الاتصال" : "Connection error"); }
    finally { setSaving(false); setTimeout(() => setToastMsg(""), 3000); }
  };

  useEffect(() => { if (expanded) load(); }, [expanded, load]);

  const managerName = (id: string | null) => {
    if (!id) return isRTL ? "غير محدد" : "Not set";
    const a = admins.find((x) => x.id === id);
    if (!a) return id;
    return [a.firstName, a.lastName].filter(Boolean).join(" ") || a.mobile || id;
  };

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: (colors as unknown as Record<string,number>).radius ?? 12, backgroundColor: colors.card, overflow: "hidden", marginBottom: 0 }}>
      <TouchableOpacity
        style={{ padding: 14, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center" }}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#FEF3C7", borderRadius: 10 }}>
          <Text style={{ fontSize: 20 }}>💳</Text>
        </View>
        <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "مدير تأكيد المدفوعات" : "Payment Manager"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left", marginTop: 2 }}>
            {managerName(currentManagerId)}
          </Text>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ margin: 16 }} />
          ) : (
            <>
              {/* "None" option */}
              <TouchableOpacity
                style={{ padding: 14, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
                onPress={() => { void pick(null); }}
                disabled={saving}
              >
                <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "— بدون مدير محدد (إشعار الكل)" : "— None (notify all admins)"}
                </Text>
                {!currentManagerId && <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
              {admins.map((a) => {
                const name = [a.firstName, a.lastName].filter(Boolean).join(" ") || a.mobile || a.id;
                const selected = currentManagerId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={{ padding: 14, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
                    onPress={() => { void pick(a.id); }}
                    disabled={saving}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                        {name}
                      </Text>
                      {a.mobile ? (
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: isRTL ? "right" : "left", marginTop: 2 }}>
                          {a.mobile}
                        </Text>
                      ) : null}
                    </View>
                    {selected && <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
          {!!toastMsg && (
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, padding: 12, textAlign: "center" }}>
              {toastMsg}
            </Text>
          )}
        </View>
      )}
    </View>
  );
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
  const [revokingOtherSessions, setRevokingOtherSessions] = useState(false);

  // Mobile-change OTP state
  const [editMobile, setEditMobile] = useState("");
  const [pendingMobile, setPendingMobile] = useState("");
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpSubtitle, setOtpSubtitle] = useState<string | undefined>(undefined);
  const [verificationToken, setVerificationToken] = useState<string | undefined>(undefined);
  const [verificationExpiresAt, setVerificationExpiresAt] = useState(0);

  useEffect(() => {
    if (mode === "change-password" && !changePwMode) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePwErrors({});
      setChangePwMode(true);
    }
    // Only react to mode entry — including changePwMode would clear fields while typing
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [mode]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ firstName?: string; email?: string; mobile?: string }>({});

  const openEdit = () => {
    if (!user) return;
    const nameParts = (user.name ?? "").split(/\s+/);
    setFirstName(nameParts[0] ?? "");
    setLastName(nameParts.slice(1).join(" ") ?? "");
    setEmail(user.email ?? "");
    setEditMobile(user.mobile ?? "");
    setVerificationToken(undefined);
    setVerificationExpiresAt(0);
    setErrors({});
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setErrors({});
  };

  const EGYPT_MOBILE_RE = /^(\+?20|0)(1[0125][0-9]{8})$/;

  const applyAdminSave = async (verTok: string | undefined) => {
    if (!user) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        email: email.trim() || null,
      };
      const mobileDigits = editMobile.trim().replace(/\s|-/g, "");
      const mobileMatch = mobileDigits ? mobileDigits.match(EGYPT_MOBILE_RE) : null;
      const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : editMobile.trim();
      if (normalizedMobile !== (user.mobile ?? "") && verTok) {
        body.mobile = normalizedMobile;
        body.verificationToken = verTok;
      }
      const result = await saveProfile(body);
      if (!result.ok) {
        throw new Error(result.error ?? t("profile.saveFailed"));
      }
      setVerificationToken(undefined);
      setVerificationExpiresAt(0);
      setEditMode(false);
      setToastMessage(t("profile.saveSuccess"));
      setToastVisible(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage(msg || t("profile.saveFailed"));
      setToastVisible(true);
    } finally {
      setSaving(false);
    }
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

    const mobileDigits = editMobile.trim().replace(/\s|-/g, "");
    const mobileMatch = mobileDigits ? mobileDigits.match(EGYPT_MOBILE_RE) : null;
    if (mobileDigits && !mobileMatch) {
      newErrors.mobile = isRTL ? "صيغة غير صحيحة — مثال: 01XXXXXXXXX" : "Invalid format — e.g. 01XXXXXXXXX";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const normalizedMobile = mobileMatch ? `0${mobileMatch[2]}` : editMobile.trim();
    const mobileChanged = normalizedMobile !== (user.mobile ?? "");

    if (mobileChanged) {
      if (verificationToken && verificationExpiresAt > Date.now() + 10_000 && normalizedMobile === pendingMobile) {
        await applyAdminSave(verificationToken);
        return;
      }
      setPendingMobile(normalizedMobile);
      setOtpSubtitle(undefined);
      setOtpModalVisible(true);
      return;
    }

    await applyAdminSave(undefined);
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
      const apiBase = getApiBase();
      const token = await getAuthToken();
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

  const handleRevokeOtherSessions = () => {
    Alert.alert(
      t("profile.revokeOtherSessionsConfirmTitle"),
      t("profile.revokeOtherSessionsConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.revokeOtherSessions"),
          style: "destructive",
          onPress: async () => {
            setRevokingOtherSessions(true);
            try {
              const apiBase = getApiBase();
              const token = await getAuthToken();
              if (!apiBase || !token) throw new Error(t("profile.noServer"));
              const res = await fetch(`${apiBase}/api/auth/revoke-other-sessions`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
              if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? t("profile.revokeOtherSessionsFailed"));
              }
              setToastMessage(t("profile.revokeOtherSessionsSuccess"));
              setToastAction(undefined);
              setToastVisible(true);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              setToastMessage(msg || t("profile.revokeOtherSessionsFailed"));
              setToastAction(undefined);
              setToastVisible(true);
            } finally {
              setRevokingOtherSessions(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    confirmDialog(
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
      ],
    );
  };

  const initials = (user?.name ?? "A")
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarUri: string | null =
    resolveMediaUrl((user as { avatar?: string | null })?.avatar, { token: sessionToken }) ?? null;

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
      const apiBase = getApiBase();
      if (apiBase) {
        const patchRes = await fetch(`${apiBase}/api/auth/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ profileImageUrl: url }),
        });
        if (!patchRes.ok) throw new Error(`Server update failed: ${patchRes.status}`);
      }
      if (user) await setUser({ ...user, avatar: resolveMediaUrl(url, { token: sessionToken }) ?? url });
      await refreshUser().catch(() => {});
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
                    const apiBase = getApiBase();
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
      <AppHeader
        title={t("admin.profile")}
        subtitle={isRTL ? "تسجيل الخروج وإدارة الجلسات" : "Sign out & session control"}
        showHome
        showBack
        showLangToggle
        showLogout
        homeHref="/(admin)/(tabs)/dashboard"
        onBack={() => router.replace("/(admin)/(tabs)/dashboard")}
      />

      <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Avatar hero */}
        <View style={[styles.hero, { backgroundColor: colors.darkMid }]}>
          <TouchableOpacity onPress={pickAdminPhoto} disabled={avatarUploading} style={[styles.avatarRing, { borderColor: colors.primary }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[styles.avatar, { borderRadius: 40 }]} resizeMode="cover" />
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

            <FanniInput
              label={t("register.mobile")}
              value={editMobile}
              onChangeText={setEditMobile}
              keyboardType="phone-pad"
              placeholder="+20 1XX XXX XXXX"
              error={errors.mobile}
            />

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

        {/* Payment Manager Picker */}
        <PaymentManagerPicker sessionToken={sessionToken} isRTL={isRTL} colors={colors} />

        {/* Sign out of all other devices */}
        <TouchableOpacity
          style={[styles.changePwBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={handleRevokeOtherSessions}
          activeOpacity={0.8}
          disabled={revokingOtherSessions}
        >
          <View style={[styles.changePwIcon, { backgroundColor: colors.accentBlue ?? "#EBF5FF", borderRadius: 10 }]}>
            {revokingOtherSessions ? (
              <ActivityIndicator size="small" color={colors.secondary ?? "#3B82F6"} />
            ) : (
              <VectorIcon name="log-out" size={20} color={colors.secondary ?? "#3B82F6"} />
            )}
          </View>
          <Text style={[styles.changePwText, { color: colors.foreground, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }]}>
            {t("profile.revokeOtherSessions")}
          </Text>
          <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
        </TouchableOpacity>

        {/* About / publisher */}
        <AppIdentityCard />

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
      </KeyboardAwareScrollViewCompat>

      <OtpVerifyModal
        visible={otpModalVisible}
        mobile={pendingMobile}
        subtitle={otpSubtitle}
        onCancel={() => { setOtpModalVisible(false); setOtpSubtitle(undefined); }}
        onVerified={(token, expiresAt) => {
          setOtpModalVisible(false);
          setOtpSubtitle(undefined);
          setVerificationToken(token);
          setVerificationExpiresAt(expiresAt);
          applyAdminSave(token);
        }}
      />

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
