import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import AppHeader from "@/components/AppHeader";

interface Permission { id: string; group: string; groupAr: string; label: string; labelAr: string; enabled: boolean; }

const INITIAL: Permission[] = [
  { id: "p1",  group: "Clients",      groupAr: "العملاء",    label: "View all clients",          labelAr: "عرض جميع العملاء",           enabled: true  },
  { id: "p2",  group: "Clients",      groupAr: "العملاء",    label: "Suspend clients",           labelAr: "إيقاف العملاء",               enabled: true  },
  { id: "p3",  group: "Clients",      groupAr: "العملاء",    label: "Delete clients",            labelAr: "حذف العملاء",                 enabled: false },
  { id: "p4",  group: "Technicians",  groupAr: "الفنيون",    label: "View all technicians",      labelAr: "عرض جميع الفنيين",            enabled: true  },
  { id: "p5",  group: "Technicians",  groupAr: "الفنيون",    label: "Approve technicians",       labelAr: "الموافقة على الفنيين",        enabled: true  },
  { id: "p6",  group: "Technicians",  groupAr: "الفنيون",    label: "Suspend technicians",       labelAr: "إيقاف الفنيين",               enabled: true  },
  { id: "p7",  group: "Technicians",  groupAr: "الفنيون",    label: "Delete technicians",        labelAr: "حذف الفنيين",                 enabled: false },
  { id: "p8",  group: "Orders",       groupAr: "الطلبات",    label: "View all orders",           labelAr: "عرض جميع الطلبات",            enabled: true  },
  { id: "p9",  group: "Orders",       groupAr: "الطلبات",    label: "Cancel orders",             labelAr: "إلغاء الطلبات",               enabled: true  },
  { id: "p10", group: "Orders",       groupAr: "الطلبات",    label: "Assign technicians",        labelAr: "تعيين الفنيين",               enabled: true  },
  { id: "p11", group: "Finance",      groupAr: "المالية",    label: "View invoices",             labelAr: "عرض الفواتير",                enabled: true  },
  { id: "p12", group: "Finance",      groupAr: "المالية",    label: "Issue refunds",             labelAr: "إصدار مستردات",               enabled: false },
  { id: "p13", group: "Finance",      groupAr: "المالية",    label: "Export financial reports",  labelAr: "تصدير تقارير مالية",          enabled: true  },
  { id: "p14", group: "System",       groupAr: "النظام",     label: "Manage admin accounts",     labelAr: "إدارة حسابات المسئولين",      enabled: false },
  { id: "p15", group: "System",       groupAr: "النظام",     label: "Modify app settings",       labelAr: "تعديل إعدادات التطبيق",       enabled: false },
];

const GROUP_ICONS: Record<string, string> = {
  Clients: "users", Technicians: "tool", Orders: "list", Finance: "dollar-sign", System: "settings",
};
const GROUP_COLORS: Record<string, string> = {
  Clients: "#4DADD9", Technicians: "#F5A623", Orders: "#7C5CBF", Finance: "#22A36B", System: "#E67E22",
};

export default function AdminPermissionsScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;
  const [perms, setPerms] = useState(INITIAL);

  const toggle = (id: string) => setPerms((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));
  const groups = [...new Set(perms.map((p) => p.group))];
  const enabledCount = perms.filter((p) => p.enabled).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.permissions")}
        subtitle={`${enabledCount}/${perms.length} ${isRTL ? "مفعلة" : "enabled"}`}
        showHome
        showLogout
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {groups.map((group) => {
          const groupPerms = perms.filter((p) => p.group === group);
          const groupColor = GROUP_COLORS[group] ?? colors.primary;
          const groupAr = groupPerms[0].groupAr;
          const enabledInGroup = groupPerms.filter((p) => p.enabled).length;
          return (
            <View key={group} style={styles.groupBlock}>
              <View style={[styles.groupHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                <View style={[styles.groupIcon, { backgroundColor: groupColor + "18", borderRadius: 10 }]}>
                  <Feather name={GROUP_ICONS[group] as any} size={16} color={groupColor} />
                </View>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? groupAr : group}
                </Text>
                <View style={[styles.groupCountBadge, { backgroundColor: groupColor + "18" }]}>
                  <Text style={{ color: groupColor, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                    {enabledInGroup}/{groupPerms.length}
                  </Text>
                </View>
              </View>
              {groupPerms.map((perm) => (
                <View
                  key={perm.id}
                  style={[
                    styles.permRow,
                    {
                      backgroundColor: perm.enabled ? colors.card : colors.muted + "80",
                      borderRadius: colors.radius - 4,
                      borderColor: perm.enabled ? groupColor + "44" : colors.border,
                      flexDirection: isRTL ? "row-reverse" : "row",
                    },
                  ]}
                >
                  <View style={[styles.permDot, { backgroundColor: perm.enabled ? groupColor : colors.border }]} />
                  <Text style={{ color: perm.enabled ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0, textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? perm.labelAr : perm.label}
                  </Text>
                  <Switch
                    value={perm.enabled}
                    onValueChange={() => toggle(perm.id)}
                    trackColor={{ false: colors.border, true: groupColor + "88" }}
                    thumbColor={perm.enabled ? groupColor : "#C8D8E8"}
                  />
                </View>
              ))}
            </View>
          );
        })}

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          <Feather name="save" size={18} color="#FFF" />
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16, marginLeft: 8 }}>{t("common.save")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  groupBlock: { marginBottom: 20 },
  groupHeader: { alignItems: "center", paddingBottom: 12, marginBottom: 10, borderBottomWidth: 1 },
  groupIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  groupCountBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12 },
  permRow: { padding: 12, marginBottom: 8, borderWidth: 1.5, alignItems: "center" },
  permDot: { width: 8, height: 8, borderRadius: 4 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, marginTop: 8 },
});
