import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon, { type IconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

interface Permission { id: string; group: string; groupAr: string; label: string; labelAr: string; enabled: boolean; }
interface AdminEntry { id: string; name: string; email: string | null; isSuperAdmin: boolean; isActive: boolean; }

const ALL_PERMISSIONS: Omit<Permission, "enabled">[] = [
  { id: "p1",               group: "Clients",      groupAr: "العملاء",    label: "View all clients",          labelAr: "عرض جميع العملاء"           },
  { id: "p2",               group: "Clients",      groupAr: "العملاء",    label: "Suspend clients",           labelAr: "إيقاف العملاء"              },
  { id: "p3",               group: "Clients",      groupAr: "العملاء",    label: "Delete clients",            labelAr: "حذف العملاء"                },
  { id: "p4",               group: "Technicians",  groupAr: "الفنيون",    label: "View all technicians",      labelAr: "عرض جميع الفنيين"           },
  { id: "p5",               group: "Technicians",  groupAr: "الفنيون",    label: "Approve technicians",       labelAr: "الموافقة على الفنيين"       },
  { id: "p6",               group: "Technicians",  groupAr: "الفنيون",    label: "Suspend technicians",       labelAr: "إيقاف الفنيين"              },
  { id: "p7",               group: "Technicians",  groupAr: "الفنيون",    label: "Delete technicians",        labelAr: "حذف الفنيين"                },
  { id: "p8",               group: "Orders",       groupAr: "الطلبات",    label: "View all orders",           labelAr: "عرض جميع الطلبات"           },
  { id: "p9",               group: "Orders",       groupAr: "الطلبات",    label: "Cancel orders",             labelAr: "إلغاء الطلبات"              },
  { id: "p10",              group: "Orders",       groupAr: "الطلبات",    label: "Assign technicians",        labelAr: "تعيين الفنيين"              },
  { id: "override_orders",  group: "Orders",       groupAr: "الطلبات",    label: "Override orders",           labelAr: "تجاوز الطلبات"              },
  { id: "p11",              group: "Finance",      groupAr: "المالية",    label: "View invoices",             labelAr: "عرض الفواتير"               },
  { id: "view_reports",     group: "Finance",      groupAr: "المالية",    label: "View financial reports",    labelAr: "عرض التقارير المالية"       },
  { id: "p12",              group: "Finance",      groupAr: "المالية",    label: "Issue refunds",             labelAr: "إصدار مستردات"              },
  { id: "p13",              group: "Finance",      groupAr: "المالية",    label: "Export financial reports",  labelAr: "تصدير تقارير مالية"         },
  { id: "manage_users",     group: "System",       groupAr: "النظام",     label: "Manage users",              labelAr: "إدارة المستخدمين"           },
  { id: "p14",              group: "System",       groupAr: "النظام",     label: "Manage admin accounts",     labelAr: "إدارة حسابات المسئولين"     },
  { id: "p15",              group: "System",       groupAr: "النظام",     label: "Modify app settings",       labelAr: "تعديل إعدادات التطبيق"      },
  { id: "manage_categories",group: "System",       groupAr: "النظام",     label: "Manage categories",         labelAr: "إدارة الفئات والتخصصات"     },
];

const DEFAULT_ENABLED = new Set(["p1","p2","p4","p5","p6","p8","p9","p10","p11","p13"]);

const GROUP_ICONS: Record<string, IconName> = {
  Clients: "users", Technicians: "tool", Orders: "list", Finance: "dollar-sign", System: "settings",
};
const GROUP_COLORS: Record<string, string> = {
  Clients: "#4DADD9", Technicians: "#F5A623", Orders: "#7C5CBF", Finance: "#22A36B", System: "#E67E22",
};

export default function AdminPermissionsScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [ownPermissions, setOwnPermissions] = useState<string[]>([]);
  const [initLoading, setInitLoading] = useState(true);

  const [adminsList, setAdminsList] = useState<AdminEntry[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminEntry | null>(null);
  const [adminPickerVisible, setAdminPickerVisible] = useState(false);
  const [perms, setPerms] = useState<Permission[]>(() =>
    ALL_PERMISSIONS.map((p) => ({ ...p, enabled: DEFAULT_ENABLED.has(p.id) }))
  );
  const [permsLoading, setPermsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  }), [sessionToken]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/admin/my-permissions`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json() as { permissions?: string[]; isSuperAdmin?: boolean };
          setIsSuperAdmin(!!data.isSuperAdmin);
          setOwnPermissions(data.permissions ?? []);
          if (data.isSuperAdmin) {
            const adminsRes = await fetch(`${getApiBase()}/api/admin/admins-list`, { headers: authHeaders() });
            if (adminsRes.ok) {
              const adminsData = await adminsRes.json() as { admins?: AdminEntry[] };
              const nonSuper = (adminsData.admins ?? []).filter((a) => !a.isSuperAdmin && a.isActive);
              setAdminsList(nonSuper);
            }
          }
        }
      } catch {}
      setInitLoading(false);
    })();
  }, [authHeaders]);

  const loadAdminPerms = useCallback(async (admin: AdminEntry) => {
    setSelectedAdmin(admin);
    setPermsLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/admin/${admin.id}/permissions`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json() as { permissions?: string[] };
        const saved = data.permissions ?? [];
        setPerms(ALL_PERMISSIONS.map((p) => ({ ...p, enabled: saved.includes(p.id) })));
      }
    } catch {}
    setPermsLoading(false);
  }, [authHeaders]);

  const toggle = (id: string) => setPerms((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));
  const groups = [...new Set(perms.map((p) => p.group))];
  const enabledCount = perms.filter((p) => p.enabled).length;

  const handleSave = async () => {
    if (!selectedAdmin) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const enabledIds = perms.filter((p) => p.enabled).map((p) => p.id);
      const res = await fetch(`${getApiBase()}/api/admin/${selectedAdmin.id}/permissions`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ permissions: enabledIds }),
      });
      if (res.ok) {
        setSaveMsg(isRTL ? "تم حفظ الصلاحيات بنجاح ✓" : "Permissions saved successfully ✓");
      } else {
        const data = await res.json() as { error?: string };
        setSaveMsg(data.error ?? (isRTL ? "فشل الحفظ" : "Save failed"));
      }
    } catch {
      setSaveMsg(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  if (initLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("admin.permissions")} showHome showLogout />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!isSuperAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader
          title={t("admin.permissions")}
          subtitle={isRTL ? "وصول محظور" : "Access Restricted"}
          showHome
          showLogout
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <VectorIcon name="lock" size={48} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 18, marginTop: 16, textAlign: "center" }}>
            {isRTL ? "الوصول محظور" : "Access Restricted"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 22 }}>
            {isRTL
              ? "إدارة الصلاحيات متاحة للمسئول الأعلى فقط.\nراجع مسئولك الأعلى إذا كنت بحاجة إلى صلاحيات إضافية."
              : "Permission management is only available to super-admins.\nContact your super-admin if you need additional access."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("admin.permissions")}
        subtitle={selectedAdmin ? (enabledCount + "/" + perms.length + (isRTL ? " مفعلة" : " enabled")) : (isRTL ? "اختر مسئولاً" : "Select an admin")}
        showHome
        showLogout
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        <TouchableOpacity
          style={[styles.adminPicker, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={() => setAdminPickerVisible(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.groupIcon, { backgroundColor: colors.accent, borderRadius: 8 }]}>
            <VectorIcon name="user" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "تحرير صلاحيات" : "Editing permissions for"}
            </Text>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
              {selectedAdmin ? selectedAdmin.name : (isRTL ? "اختر مسئولاً..." : "Select an admin...")}
            </Text>
          </View>
          <VectorIcon name="chevron-down" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {adminsList.length === 0 && (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 16 }}>
            {isRTL ? "لا يوجد مسئولون آخرون" : "No other admins found"}
          </Text>
        )}

        {selectedAdmin && (
          permsLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {groups.map((group) => {
                const groupPerms = perms.filter((p) => p.group === group);
                const groupColor = GROUP_COLORS[group] ?? colors.primary;
                const groupAr = groupPerms[0]!.groupAr;
                const enabledInGroup = groupPerms.filter((p) => p.enabled).length;
                return (
                  <View key={group} style={styles.groupBlock}>
                    <View style={[styles.groupHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                      <View style={[styles.groupIcon, { backgroundColor: groupColor + "18", borderRadius: 10 }]}>
                        <VectorIcon name={GROUP_ICONS[group] ?? "settings"} size={16} color={groupColor} />
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
                        style={[styles.permRow, {
                          backgroundColor: perm.enabled ? colors.card : colors.muted + "80",
                          borderRadius: colors.radius - 4,
                          borderColor: perm.enabled ? groupColor + "44" : colors.border,
                          flexDirection: isRTL ? "row-reverse" : "row",
                        }]}
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

              {!!saveMsg && (
                <Text style={{ color: saveMsg.includes("✓") ? colors.success ?? colors.primary : colors.destructive, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center", marginBottom: 12 }}>
                  {saveMsg}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : (
                    <>
                      <VectorIcon name="save" size={18} color="#FFF" />
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16, marginLeft: 8 }}>{t("common.save")}</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </>
          )
        )}
      </ScrollView>

      <Modal visible={adminPickerVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAdminPickerVisible(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 16, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "اختر مسئولاً" : "Select Admin"}
          </Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {adminsList.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingVertical: 24 }}>
                {isRTL ? "لا يوجد مسئولون" : "No admins found"}
              </Text>
            ) : (
              adminsList.map((admin) => (
                <TouchableOpacity
                  key={admin.id}
                  style={[styles.adminRow, {
                    flexDirection: isRTL ? "row-reverse" : "row",
                    backgroundColor: selectedAdmin?.id === admin.id ? colors.accent : "transparent",
                    borderRadius: colors.radius - 4,
                  }]}
                  onPress={() => {
                    setAdminPickerVisible(false);
                    loadAdminPerms(admin);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.adminAvatar, { backgroundColor: colors.primary + "22" }]}>
                    <VectorIcon name="user" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                      {admin.name}
                    </Text>
                    {admin.email && (
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                        {admin.email}
                      </Text>
                    )}
                  </View>
                  {selectedAdmin?.id === admin.id && (
                    <VectorIcon name="check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  readOnlyBanner: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  adminPicker: { flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1.5, marginBottom: 20 },
  groupBlock: { marginBottom: 20 },
  groupHeader: { alignItems: "center", paddingBottom: 12, marginBottom: 10, borderBottomWidth: 1 },
  groupIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  groupCountBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12 },
  permRow: { padding: 12, marginBottom: 8, borderWidth: 1.5, alignItems: "center" },
  permDot: { width: 8, height: 8, borderRadius: 4 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  adminRow: { flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 4 },
  adminAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
