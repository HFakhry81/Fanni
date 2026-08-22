import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Switch,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "@/components/AppHeader";
import FanniButton from "@/components/FanniButton";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/utils/api";

interface LeadPricingRule {
  id: string;
  serviceCategory: string | null;
  serviceSpecialization: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  pointsCost: number;
  isActive: boolean;
  priority: number;
  description: string | null;
}

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyForm = {
  serviceCategory: "",
  serviceSpecialization: "",
  dayOfWeek: "",
  startTime: "",
  endTime: "",
  pointsCost: "20",
  priority: "0",
  description: "",
  isActive: true,
};

export default function LeadPricingScreen() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [rules, setRules] = useState<LeadPricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  }), [sessionToken]);

  const loadRules = useCallback(async (isRefresh = false) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/admin/lead-pricing-rules`, { headers: headers() });
      const json = await res.json() as { rules?: LeadPricingRule[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRules(json.rules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, headers]);

  useFocusEffect(useCallback(() => { void loadRules(); }, [loadRules]));

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (rule: LeadPricingRule) => {
    setEditingId(rule.id);
    setForm({
      serviceCategory: rule.serviceCategory ?? "",
      serviceSpecialization: rule.serviceSpecialization ?? "",
      dayOfWeek: rule.dayOfWeek == null ? "" : String(rule.dayOfWeek),
      startTime: rule.startTime ?? "",
      endTime: rule.endTime ?? "",
      pointsCost: String(rule.pointsCost),
      priority: String(rule.priority),
      description: rule.description ?? "",
      isActive: rule.isActive,
    });
    setModalOpen(true);
  };

  const saveRule = async () => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    const pointsCost = Number(form.pointsCost);
    if (!Number.isFinite(pointsCost) || pointsCost < 1) {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "تكلفة النقاط لازم تكون رقم أكبر من صفر" : "Points cost must be a positive number");
      return;
    }
    const dayRaw = form.dayOfWeek.trim();
    const dayOfWeek = dayRaw === "" ? null : Number(dayRaw);
    if (dayOfWeek != null && (dayOfWeek < 0 || dayOfWeek > 6 || !Number.isInteger(dayOfWeek))) {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "يوم الأسبوع من 0 (الأحد) إلى 6 (السبت)" : "Day of week must be 0 (Sun) to 6 (Sat)");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        serviceCategory: form.serviceCategory.trim() || null,
        serviceSpecialization: form.serviceSpecialization.trim() || null,
        dayOfWeek,
        startTime: form.startTime.trim() || null,
        endTime: form.endTime.trim() || null,
        pointsCost,
        priority: Number(form.priority) || 0,
        description: form.description.trim() || null,
        isActive: form.isActive,
      };
      const res = await fetch(
        editingId
          ? `${apiBase}/api/admin/lead-pricing-rules/${editingId}`
          : `${apiBase}/api/admin/lead-pricing-rules`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: headers(),
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setModalOpen(false);
      await loadRules();
    } catch (err) {
      Alert.alert(isRTL ? "خطأ" : "Error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: LeadPricingRule) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    try {
      await fetch(`${apiBase}/api/admin/lead-pricing-rules/${rule.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      await loadRules(true);
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "تعذر تحديث القاعدة" : "Could not update rule");
    }
  };

  const dayLabel = (day: number | null) => {
    if (day == null) return isRTL ? "كل الأيام" : "All days";
    return isRTL ? DAYS_AR[day] : DAYS_EN[day];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "تسعير Lead" : "Lead Pricing"}
        subtitle={isRTL ? "القواعد الأعلى أولوية تُطبَّق أولاً · الافتراضي 20" : "Highest priority wins · default 20"}
        showBack
      />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rules}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 80, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRules(true)} tintColor={colors.primary} />}
          ListEmptyComponent={
            <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40, fontFamily: "Inter_400Regular" }}>
              {error || (isRTL ? "مفيش قواعد. هيتم استخدام 20 نقطة كافتراضي." : "No rules yet. Default cost is 20 points.")}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openEdit(item)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: isRTL ? "right" : "left" }}>
                  {item.pointsCost} {isRTL ? "نقطة" : "pts"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4, textAlign: isRTL ? "right" : "left" }}>
                  {(item.serviceCategory || (isRTL ? "كل الخدمات" : "All services"))
                    + (item.serviceSpecialization ? ` · ${item.serviceSpecialization}` : "")}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                  {dayLabel(item.dayOfWeek)}
                  {item.startTime && item.endTime ? ` · ${item.startTime}–${item.endTime}` : ""}
                  {` · ${isRTL ? "أولوية" : "priority"} ${item.priority}`}
                </Text>
              </View>
              <Switch value={item.isActive} onValueChange={() => { void toggleActive(item); }} />
            </TouchableOpacity>
          )}
        />
      )}
      <View style={[styles.fabWrap, { paddingBottom: botPad + 12 }]}>
        <FanniButton title={isRTL ? "قاعدة جديدة" : "New rule"} onPress={openCreate} />
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: botPad + 16 }]}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: isRTL ? "right" : "left" }}>
              {editingId ? (isRTL ? "تعديل القاعدة" : "Edit rule") : (isRTL ? "قاعدة جديدة" : "New rule")}
            </Text>
            {([
              ["serviceCategory", isRTL ? "الفئة (فارغ = الكل)" : "Category (empty = all)"],
              ["serviceSpecialization", isRTL ? "التخصص (فارغ = الكل)" : "Specialization (empty = all)"],
              ["dayOfWeek", isRTL ? "يوم الأسبوع 0–6 (فارغ = الكل)" : "Day 0–6 (empty = all)"],
              ["startTime", isRTL ? "من (HH:mm)" : "Start (HH:mm)"],
              ["endTime", isRTL ? "إلى (HH:mm)" : "End (HH:mm)"],
              ["pointsCost", isRTL ? "تكلفة النقاط" : "Points cost"],
              ["priority", isRTL ? "الأولوية" : "Priority"],
              ["description", isRTL ? "وصف" : "Description"],
            ] as const).map(([key, label]) => (
              <View key={key} style={{ marginTop: 10 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", textAlign: isRTL ? "right" : "left" }}>{label}</Text>
                <TextInput
                  value={form[key]}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, [key]: value }))}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, textAlign: isRTL ? "right" : "left" }]}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            ))}
            <View style={[styles.activeRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>{isRTL ? "مفعّلة" : "Active"}</Text>
              <Switch value={form.isActive} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))} />
            </View>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => setModalOpen(false)}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }}>{isRTL ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <FanniButton title={isRTL ? "حفظ" : "Save"} onPress={() => { void saveRule(); }} loading={saving} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  fabWrap: { paddingHorizontal: 16, paddingTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "92%" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4, fontFamily: "Inter_400Regular" },
  activeRow: { alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  modalBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
});
