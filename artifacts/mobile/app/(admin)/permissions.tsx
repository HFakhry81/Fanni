import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

interface Permission {
  id: string;
  label: string;
  labelAr: string;
  group: string;
  groupAr: string;
  enabled: boolean;
}

const INITIAL_PERMISSIONS: Permission[] = [
  { id: "p1", group: "Clients", groupAr: "العملاء", label: "View all clients", labelAr: "عرض جميع العملاء", enabled: true },
  { id: "p2", group: "Clients", groupAr: "العملاء", label: "Suspend clients", labelAr: "إيقاف العملاء", enabled: true },
  { id: "p3", group: "Clients", groupAr: "العملاء", label: "Delete clients", labelAr: "حذف العملاء", enabled: false },
  { id: "p4", group: "Technicians", groupAr: "الفنيون", label: "View all technicians", labelAr: "عرض جميع الفنيين", enabled: true },
  { id: "p5", group: "Technicians", groupAr: "الفنيون", label: "Approve technicians", labelAr: "الموافقة على الفنيين", enabled: true },
  { id: "p6", group: "Technicians", groupAr: "الفنيون", label: "Suspend technicians", labelAr: "إيقاف الفنيين", enabled: true },
  { id: "p7", group: "Technicians", groupAr: "الفنيون", label: "Delete technicians", labelAr: "حذف الفنيين", enabled: false },
  { id: "p8", group: "Orders", groupAr: "الطلبات", label: "View all orders", labelAr: "عرض جميع الطلبات", enabled: true },
  { id: "p9", group: "Orders", groupAr: "الطلبات", label: "Cancel orders", labelAr: "إلغاء الطلبات", enabled: true },
  { id: "p10", group: "Orders", groupAr: "الطلبات", label: "Assign technicians", labelAr: "تعيين الفنيين", enabled: true },
  { id: "p11", group: "Finance", groupAr: "المالية", label: "View invoices", labelAr: "عرض الفواتير", enabled: true },
  { id: "p12", group: "Finance", groupAr: "المالية", label: "Issue refunds", labelAr: "إصدار مستردات", enabled: false },
  { id: "p13", group: "Finance", groupAr: "المالية", label: "Export financial reports", labelAr: "تصدير تقارير مالية", enabled: true },
  { id: "p14", group: "System", groupAr: "النظام", label: "Manage admin accounts", labelAr: "إدارة حسابات المسئولين", enabled: false },
  { id: "p15", group: "System", groupAr: "النظام", label: "Modify app settings", labelAr: "تعديل إعدادات التطبيق", enabled: false },
];

export default function AdminPermissionsScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState(INITIAL_PERMISSIONS);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const togglePermission = (id: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const groups = [...new Set(permissions.map((p) => p.group))];

  const enabledCount = permissions.filter((p) => p.enabled).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: topPad + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 20, textAlign: isRTL ? "right" : "left" }}>
            {t("admin.permissions")}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
            {enabledCount}/{permissions.length} {isRTL ? "صلاحية مفعلة" : "permissions enabled"}
          </Text>
        </View>
        <View style={[styles.shieldBadge, { backgroundColor: colors.primary + "33" }]}>
          <Feather name="shield" size={22} color={colors.primary} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {groups.map((group) => {
          const groupPerms = permissions.filter((p) => p.group === group);
          const groupPerm = groupPerms[0];
          return (
            <View key={group} style={styles.groupBlock}>
              <View style={[styles.groupHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                <Feather
                  name={
                    group === "Clients" ? "users" :
                    group === "Technicians" ? "tool" :
                    group === "Orders" ? "list" :
                    group === "Finance" ? "dollar-sign" :
                    "settings"
                  }
                  size={16}
                  color={colors.primary}
                />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                  {isRTL ? groupPerm.groupAr : group}
                </Text>
              </View>
              {groupPerms.map((perm) => (
                <View
                  key={perm.id}
                  style={[
                    styles.permRow,
                    {
                      backgroundColor: colors.card,
                      borderRadius: colors.radius,
                      borderColor: perm.enabled ? colors.primary + "33" : colors.border,
                      flexDirection: isRTL ? "row-reverse" : "row",
                    },
                  ]}
                >
                  <View style={[styles.permDot, { backgroundColor: perm.enabled ? colors.success : colors.border }]} />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                      flex: 1,
                      marginLeft: isRTL ? 0 : 10,
                      marginRight: isRTL ? 10 : 0,
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    {isRTL ? perm.labelAr : perm.label}
                  </Text>
                  <Switch
                    value={perm.enabled}
                    onValueChange={() => togglePermission(perm.id)}
                    trackColor={{ false: colors.border, true: colors.primary + "88" }}
                    thumbColor={perm.enabled ? colors.primary : colors.muted}
                  />
                </View>
              ))}
            </View>
          );
        })}

        {/* Save button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: colors.primary, borderRadius: colors.radius },
          ]}
          activeOpacity={0.85}
        >
          <Feather name="save" size={18} color="#FFF" />
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16, marginLeft: 8 }}>
            {t("common.save")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  shieldBadge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  groupBlock: { marginBottom: 20 },
  groupHeader: { alignItems: "center", paddingBottom: 12, marginBottom: 10, borderBottomWidth: 1, gap: 0 },
  permRow: { paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: 1.5, alignItems: "center" },
  permDot: { width: 8, height: 8, borderRadius: 4 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, marginTop: 8 },
});
