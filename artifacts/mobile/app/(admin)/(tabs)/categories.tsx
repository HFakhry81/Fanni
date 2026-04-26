import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon, { type IconName, toIconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
  return domain ? `https://${domain}` : "";
}

interface Domain {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string | null;
  isActive: boolean;
  specializationCount: number;
}

interface Specialization {
  id: string;
  domainId: string;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
}

const ICON_OPTIONS: IconName[] = [
  "zap", "droplet", "wind", "tool", "monitor", "pen-tool", "shield", "grid",
  "home", "settings", "star", "package", "camera", "tv", "thermometer",
];

export default function AdminCategoriesScreen() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [canManage, setCanManage] = useState(false);
  const [permLoading, setPermLoading] = useState(true);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [specializations, setSpecializations] = useState<Record<string, Specialization[]>>({});
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [domainModal, setDomainModal] = useState<{ visible: boolean; editing: Domain | null }>({ visible: false, editing: null });
  const [specModal, setSpecModal] = useState<{ visible: boolean; domainId: string; editing: Specialization | null }>({ visible: false, domainId: "", editing: null });

  const [formNameEn, setFormNameEn] = useState("");
  const [formNameAr, setFormNameAr] = useState("");
  const [formIcon, setFormIcon] = useState<IconName>("tool");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  }), [sessionToken]);

  useEffect(() => {
    fetch(`${getApiBase()}/api/admin/my-permissions`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: { permissions?: string[]; isSuperAdmin?: boolean }) => {
        setCanManage(!!d.isSuperAdmin || !!(d.permissions?.includes("manage_categories")));
      })
      .catch(() => {})
      .finally(() => setPermLoading(false));
  }, [authHeaders]);

  const loadDomains = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${getApiBase()}/api/admin/categories/domains`, { headers: authHeaders() });
      const data = await res.json() as { domains?: Domain[]; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to load"); return; }
      setDomains(data.domains ?? []);
    } catch {
      setError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, isRTL]);

  const loadSpecializations = useCallback(async (domainId: string) => {
    try {
      const res = await fetch(`${getApiBase()}/api/admin/categories/specializations?domainId=${domainId}`, { headers: authHeaders() });
      const data = await res.json() as { specializations?: Specialization[] };
      if (res.ok) setSpecializations((prev) => ({ ...prev, [domainId]: data.specializations ?? [] }));
    } catch {}
  }, [authHeaders]);

  useEffect(() => {
    if (!permLoading) loadDomains();
  }, [permLoading, loadDomains]);

  const toggleExpand = (id: string) => {
    if (expandedDomain === id) {
      setExpandedDomain(null);
    } else {
      setExpandedDomain(id);
      if (!specializations[id]) loadSpecializations(id);
    }
  };

  const openDomainModal = (domain?: Domain) => {
    setFormNameEn(domain?.nameEn ?? "");
    setFormNameAr(domain?.nameAr ?? "");
    setFormIcon(toIconName(domain?.icon));
    setFormError("");
    setDomainModal({ visible: true, editing: domain ?? null });
  };

  const openSpecModal = (domainId: string, spec?: Specialization) => {
    setFormNameEn(spec?.nameEn ?? "");
    setFormNameAr(spec?.nameAr ?? "");
    setFormError("");
    setSpecModal({ visible: true, domainId, editing: spec ?? null });
  };

  const saveDomain = async () => {
    if (!formNameAr.trim()) { setFormError(isRTL ? "الاسم بالعربية مطلوب" : "Arabic name is required"); return; }
    setFormSaving(true);
    setFormError("");
    try {
      const editing = domainModal.editing;
      const url = editing
        ? `${getApiBase()}/api/admin/categories/domains/${editing.id}`
        : `${getApiBase()}/api/admin/categories/domains`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({ nameEn: formNameEn.trim(), nameAr: formNameAr.trim(), icon: formIcon }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setFormError(data.error ?? "Failed to save"); return; }
      setDomainModal({ visible: false, editing: null });
      loadDomains();
    } catch {
      setFormError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setFormSaving(false);
    }
  };

  const saveSpec = async () => {
    if (!formNameAr.trim()) { setFormError(isRTL ? "الاسم بالعربية مطلوب" : "Arabic name is required"); return; }
    setFormSaving(true);
    setFormError("");
    try {
      const editing = specModal.editing;
      const url = editing
        ? `${getApiBase()}/api/admin/categories/specializations/${editing.id}`
        : `${getApiBase()}/api/admin/categories/specializations`;
      const method = editing ? "PATCH" : "POST";
      const body = editing
        ? { nameEn: formNameEn.trim(), nameAr: formNameAr.trim() }
        : { domainId: specModal.domainId, nameEn: formNameEn.trim(), nameAr: formNameAr.trim() };
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setFormError(data.error ?? "Failed to save"); return; }
      setSpecModal({ visible: false, domainId: "", editing: null });
      loadSpecializations(specModal.domainId);
      loadDomains();
    } catch {
      setFormError(isRTL ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setFormSaving(false);
    }
  };

  const toggleDomainActive = async (domain: Domain) => {
    try {
      await fetch(`${getApiBase()}/api/admin/categories/domains/${domain.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !domain.isActive }),
      });
      loadDomains();
    } catch {}
  };

  const toggleSpecActive = async (spec: Specialization) => {
    try {
      await fetch(`${getApiBase()}/api/admin/categories/specializations/${spec.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !spec.isActive }),
      });
      loadSpecializations(spec.domainId);
    } catch {}
  };

  const deleteDomain = async (domain: Domain) => {
    Alert.alert(
      isRTL ? "حذف المجال" : "Delete Domain",
      isRTL ? `هل أنت متأكد من حذف "${domain.nameAr}"؟ سيتم حذف جميع التخصصات المرتبطة.`
             : `Delete "${domain.nameEn}"? All related specializations will be deleted.`,
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "حذف" : "Delete", style: "destructive",
          onPress: async () => {
            try {
              await fetch(`${getApiBase()}/api/admin/categories/domains/${domain.id}`, { method: "DELETE", headers: authHeaders() });
              loadDomains();
              if (expandedDomain === domain.id) setExpandedDomain(null);
            } catch {}
          },
        },
      ]
    );
  };

  const deleteSpec = async (spec: Specialization) => {
    Alert.alert(
      isRTL ? "حذف التخصص" : "Delete Specialization",
      isRTL ? `هل أنت متأكد من حذف "${spec.nameAr}"؟` : `Delete "${spec.nameEn}"?`,
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "حذف" : "Delete", style: "destructive",
          onPress: async () => {
            try {
              await fetch(`${getApiBase()}/api/admin/categories/specializations/${spec.id}`, { method: "DELETE", headers: authHeaders() });
              loadSpecializations(spec.domainId);
              loadDomains();
            } catch {}
          },
        },
      ]
    );
  };

  const isPageLoading = permLoading || loading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "الفئات والتخصصات" : "Categories & Specializations"}
        subtitle={`${domains.length} ${isRTL ? "مجالات" : "domains"}`}
        showHome
        showLogout
      />

      {isPageLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive, fontFamily: "Inter_500Medium", fontSize: 14, textAlign: "center" }}>{error}</Text>
          <TouchableOpacity onPress={loadDomains} style={[styles.retryBtn, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>{isRTL ? "إعادة المحاولة" : "Retry"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
          {!canManage && (
            <View style={[styles.readOnlyBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <VectorIcon name="lock" size={15} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, marginLeft: 8, textAlign: isRTL ? "right" : "left" }}>
                {isRTL
                  ? "عرض للقراءة فقط — يتطلب صلاحية 'إدارة الفئات' لإجراء تعديلات"
                  : "View only — 'Manage categories' permission required to make changes"}
              </Text>
            </View>
          )}

          {canManage && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={() => openDomainModal()}
              activeOpacity={0.85}
            >
              <VectorIcon name="plus" size={18} color="#FFF" />
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: 8 }}>
                {isRTL ? "إضافة مجال جديد" : "Add New Domain"}
              </Text>
            </TouchableOpacity>
          )}

          {domains.map((domain) => {
            const isExpanded = expandedDomain === domain.id;
            const specs = specializations[domain.id] ?? [];
            return (
              <View key={domain.id} style={[styles.domainCard, { backgroundColor: colors.card, borderColor: domain.isActive ? colors.border : colors.border + "80", borderRadius: colors.radius, opacity: domain.isActive ? 1 : 0.75 }]}>
                <TouchableOpacity
                  style={[styles.domainRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
                  onPress={() => toggleExpand(domain.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.domainIcon, { backgroundColor: domain.isActive ? colors.accent : colors.muted }]}>
                    <VectorIcon name={toIconName(domain.icon)} size={18} color={domain.isActive ? colors.primary : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
                    <Text style={{ color: domain.isActive ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL ? domain.nameAr : domain.nameEn}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL ? domain.nameEn : domain.nameAr} · {domain.specializationCount} {isRTL ? "تخصص" : "specializations"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {!domain.isActive && (
                      <View style={[styles.inactiveBadge, { backgroundColor: colors.muted }]}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                          {isRTL ? "معطّل" : "Inactive"}
                        </Text>
                      </View>
                    )}
                    {canManage && (
                      <>
                        <TouchableOpacity onPress={() => toggleDomainActive(domain)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <VectorIcon name={domain.isActive ? "eye-off" : "eye"} size={15} color={domain.isActive ? colors.mutedForeground : colors.success ?? colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openDomainModal(domain)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <VectorIcon name="edit-2" size={15} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteDomain(domain)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <VectorIcon name="trash-2" size={15} color={colors.destructive} />
                        </TouchableOpacity>
                      </>
                    )}
                    <VectorIcon name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.specsContainer, { borderTopColor: colors.border }]}>
                    {specs.length === 0 ? (
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingVertical: 12 }}>
                        {isRTL ? "لا توجد تخصصات بعد" : "No specializations yet"}
                      </Text>
                    ) : (
                      specs.map((spec) => (
                        <View
                          key={spec.id}
                          style={[styles.specRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}
                        >
                          <View style={[styles.specDot, { backgroundColor: spec.isActive ? colors.primary : colors.border }]} />
                          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
                            <Text style={{ color: spec.isActive ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                              {isRTL ? spec.nameAr : spec.nameEn}
                            </Text>
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, textAlign: isRTL ? "right" : "left" }}>
                              {isRTL ? spec.nameEn : spec.nameAr}
                              {!spec.isActive && ` · ${isRTL ? "معطّل" : "Inactive"}`}
                            </Text>
                          </View>
                          {canManage && (
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <TouchableOpacity onPress={() => toggleSpecActive(spec)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <VectorIcon name={spec.isActive ? "eye-off" : "eye"} size={13} color={spec.isActive ? colors.mutedForeground : colors.success ?? colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => openSpecModal(domain.id, spec)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <VectorIcon name="edit-2" size={13} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => deleteSpec(spec)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <VectorIcon name="trash-2" size={13} color={colors.destructive} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))
                    )}
                    {canManage && (
                      <TouchableOpacity
                        style={[styles.addSpecBtn, { borderColor: colors.primary }]}
                        onPress={() => openSpecModal(domain.id)}
                        activeOpacity={0.85}
                      >
                        <VectorIcon name="plus" size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>
                          {isRTL ? "إضافة تخصص" : "Add Specialization"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Domain Modal */}
      <Modal visible={domainModal.visible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDomainModal({ visible: false, editing: null })} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 20, textAlign: isRTL ? "right" : "left" }}>
            {domainModal.editing
              ? (isRTL ? "تعديل المجال" : "Edit Domain")
              : (isRTL ? "إضافة مجال جديد" : "Add New Domain")}
          </Text>

          <Text style={[styles.inputLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "الاسم بالإنجليزية" : "English Name"} *
          </Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={formNameEn}
            onChangeText={setFormNameEn}
            placeholder="e.g. Electricity"
            placeholderTextColor={colors.mutedForeground}
            textAlign={isRTL ? "right" : "left"}
          />

          <Text style={[styles.inputLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "الاسم بالعربية" : "Arabic Name"} *
          </Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={formNameAr}
            onChangeText={setFormNameAr}
            placeholder="مثال: كهرباء"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
          />

          <Text style={[styles.inputLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "الأيقونة" : "Icon"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
              {ICON_OPTIONS.map((ico) => (
                <TouchableOpacity
                  key={ico}
                  onPress={() => setFormIcon(ico)}
                  style={[styles.iconOption, {
                    backgroundColor: formIcon === ico ? colors.accent : colors.muted,
                    borderColor: formIcon === ico ? colors.primary : colors.border,
                    borderRadius: 10,
                  }]}
                >
                  <VectorIcon name={ico} size={20} color={formIcon === ico ? colors.primary : colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {!!formError && (
            <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>
              {formError}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.saveModalBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: formSaving ? 0.6 : 1 }]}
            onPress={saveDomain}
            disabled={formSaving}
          >
            {formSaving ? <ActivityIndicator size="small" color="#FFF" /> : (
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                {isRTL ? "حفظ" : "Save"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Specialization Modal */}
      <Modal visible={specModal.visible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSpecModal({ visible: false, domainId: "", editing: null })} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 20, textAlign: isRTL ? "right" : "left" }}>
            {specModal.editing
              ? (isRTL ? "تعديل التخصص" : "Edit Specialization")
              : (isRTL ? "إضافة تخصص" : "Add Specialization")}
          </Text>

          <Text style={[styles.inputLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "الاسم بالإنجليزية" : "English Name"} *
          </Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={formNameEn}
            onChangeText={setFormNameEn}
            placeholder="e.g. Wiring"
            placeholderTextColor={colors.mutedForeground}
            textAlign={isRTL ? "right" : "left"}
          />

          <Text style={[styles.inputLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "الاسم بالعربية" : "Arabic Name"} *
          </Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={formNameAr}
            onChangeText={setFormNameAr}
            placeholder="مثال: أسلاك"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
          />

          {!!formError && (
            <Text style={{ color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 12, textAlign: isRTL ? "right" : "left" }}>
              {formError}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.saveModalBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: formSaving ? 0.6 : 1 }]}
            onPress={saveSpec}
            disabled={formSaving}
          >
            {formSaving ? <ActivityIndicator size="small" color="#FFF" /> : (
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                {isRTL ? "حفظ" : "Save"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  readOnlyBanner: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, marginBottom: 20 },
  domainCard: { marginBottom: 12, borderWidth: 1.5, overflow: "hidden" },
  domainRow: { padding: 14, alignItems: "center" },
  domainIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  inactiveBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  specsContainer: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  specRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  specDot: { width: 8, height: 8, borderRadius: 4 },
  addSpecBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderWidth: 1, borderRadius: 8, justifyContent: "center", marginTop: 8, marginBottom: 4 },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  inputLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 6 },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 14 },
  iconOption: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  saveModalBtn: { paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
