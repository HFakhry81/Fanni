import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon, { type IconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

type Role = "client" | "technician" | "admin";

interface RoleOption {
  role: Role;
  icon: IconName;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
}

const ROLES: RoleOption[] = [
  {
    role: "client",
    icon: "home",
    ar: "عميل",
    en: "Client",
    descAr: "أطلب خدمات الصيانة المنزلية",
    descEn: "Request home maintenance services",
  },
  {
    role: "technician",
    icon: "tool",
    ar: "فني",
    en: "Technician",
    descAr: "قدّم خدماتك كفني محترف",
    descEn: "Offer your services as a professional technician",
  },
  {
    role: "admin",
    icon: "shield",
    ar: "مسئول نظام",
    en: "Admin",
    descAr: "إدارة المنصة والمستخدمين",
    descEn: "Manage the platform and users",
  },
];

export default function SelectRoleScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { setRole, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);

  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await setRole(selected);
      if (selected === "client") router.replace("/(client)/home");
      else if (selected === "technician") router.replace("/(tech)/map");
      else router.replace("/(admin)/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/welcome");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "اختيار نوع الحساب" : "Select Account Type"}
        showBack={false}
        showLangToggle
        rightElement={
          <TouchableOpacity onPress={handleLogout} style={{ padding: 8 }}>
            <VectorIcon name="log-out" size={20} color="#fff" />
          </TouchableOpacity>
        }
      />

      <View style={[styles.content, { paddingBottom: botPad + 24 }]}>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }]}>
          {isRTL
            ? "اختر كيف ستستخدم تطبيق فني"
            : "Choose how you will use the Fanni app"}
        </Text>

        <View style={styles.roleList}>
          {ROLES.map((opt) => {
            const isSelected = selected === opt.role;
            return (
              <TouchableOpacity
                key={opt.role}
                style={[
                  styles.roleCard,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: colors.radius * 1.5,
                    flexDirection: isRTL ? "row-reverse" : "row",
                  },
                ]}
                onPress={() => setSelected(opt.role)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.2)"
                        : colors.accentBlue,
                    },
                  ]}
                >
                  <VectorIcon
                    name={opt.icon}
                    size={24}
                    color={isSelected ? "#fff" : colors.primary}
                  />
                </View>
                <View style={[styles.roleText, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
                  <Text
                    style={[
                      styles.roleLabel,
                      {
                        color: isSelected ? "#fff" : colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                        textAlign: isRTL ? "right" : "left",
                      },
                    ]}
                  >
                    {isRTL ? opt.ar : opt.en}
                  </Text>
                  <Text
                    style={[
                      styles.roleDesc,
                      {
                        color: isSelected ? "rgba(255,255,255,0.8)" : colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        textAlign: isRTL ? "right" : "left",
                      },
                    ]}
                  >
                    {isRTL ? opt.descAr : opt.descEn}
                  </Text>
                </View>
                {isSelected && (
                  <VectorIcon
                    name="check-circle"
                    size={20}
                    color="#fff"
                    style={{ alignSelf: "center", marginHorizontal: 8 }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.confirmBtn,
            {
              backgroundColor: selected ? colors.primary : colors.muted,
              borderRadius: colors.radius,
              opacity: loading ? 0.7 : 1,
            },
          ]}
          onPress={handleConfirm}
          disabled={!selected || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.confirmText, { fontFamily: "Inter_700Bold" }]}>
              {isRTL ? "تأكيد" : "Confirm"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  roleList: { gap: 12 },
  roleCard: {
    padding: 16,
    borderWidth: 2,
    alignItems: "center",
    gap: 14,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  roleText: { flex: 1, gap: 4 },
  roleLabel: { fontSize: 16 },
  roleDesc: { fontSize: 13, lineHeight: 18 },
  confirmBtn: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
  },
});
