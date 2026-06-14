// app/(admin)/missed-locations.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator, Alert, TextInput } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import VectorIcon from "@/components/VectorIcon";
import AppHeader from "@/components/AppHeader";
import LocationPicker from "@/components/LocationPicker"; // المنتقي الموحد الذي قمنا بتعديله في المقطع السابق

interface MissedLocation {
  id: string;
  suburbAr: string;
  suburbEn: string;
  cityAr: string;
  cityEn: string;
  latitude: number;
  longitude: number;
  hitCount: number;
}

export default function MissedLocationsScreen() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [logs, setLogs] = useState<MissedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<MissedLocation | null>(null);
  const [saving, setSaving] = useState(false);

  // حقول تحديد المنطقة البديلة
  const [govId, setGovId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [aliasNameAr, setAliasNameAr] = useState("");
  const [aliasNameEn, setAliasNameEn] = useState("");

  const fetchMissLogs = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
      const res = await fetch(`http://${domain}/api/admin/location-miss-log`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchMissLogs();
  }, [fetchMissLogs]);

  const openResolveModal = (log: MissedLocation) => {
    setSelectedLog(log);
    setGovId("");
    setAreaId("");
    setAliasNameAr(log.suburbAr || log.cityAr);
    setAliasNameEn(log.suburbEn || log.cityEn);
  };

  const handleResolve = async () => {
    if (!selectedLog || !sessionToken) return;
    if (!govId || !areaId || !aliasNameAr.trim() || !aliasNameEn.trim()) {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "يرجى ملء جميع الحقول وتحديد المنطقة" : "Please fill all fields and select the area");
      return;
    }

    setSaving(true);
    try {
      const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
      const res = await fetch(`http://${domain}/api/admin/location-aliases`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logId: selectedLog.id,
          governorateId: govId,
          areaId: areaId,
          aliasAr: aliasNameAr.trim(),
          aliasEn: aliasNameEn.trim(),
        }),
      });

      if (res.ok) {
        Alert.alert(isRTL ? "نجاح" : "Success", isRTL ? "تم دمج وحفظ الاسم البديل للمنطقة بنجاح" : "Location alias successfully mapped and resolved");
        setSelectedLog(null);
        fetchMissLogs();
      } else {
        Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل حفظ البيانات" : "Failed to save resolved alias");
      }
    } catch {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "خطأ في الاتصال بالخادم" : "Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader 
        title={isRTL ? "معالجة العناوين غير المطابقة" : "Resolve Missed Locations"} 
        subtitle={isRTL ? `${logs.length} عنوان يحتاج لتوجيه` : `${logs.length} unmatched coordinates`}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={styles.flex1}>
                  <Text style={[styles.cardTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? item.suburbAr || item.cityAr : item.suburbEn || item.cityEn}
                  </Text>
                  <Text style={[styles.cardCoords, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                    Lat: {item.latitude.toFixed(5)} , Lng: {item.longitude.toFixed(5)}
                  </Text>
                </View>
                <View style={[styles.hitBadge, { backgroundColor: colors.destructive + "15" }]}>
                  <Text style={{ color: colors.destructive, fontFamily: "Inter_700Bold", fontSize: 11 }}>
                    {item.hitCount} {isRTL ? "محاولات" : "Hits"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.resolveBtn, { backgroundColor: colors.secondary }]}
                onPress={() => openResolveModal(item)}
              >
                <VectorIcon name="map" size={14} color="#FFF" />
                <Text style={styles.resolveBtnText}>
                  {isRTL ? "ربط بالمنطقة الرسمية" : "Map to Official Area"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <VectorIcon name="check-circle" size={48} color={colors.success} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_500Medium" }}>
                {isRTL ? "جميع العناوين مطابقة تماماً!" : "All locations mapped perfectly!"}
              </Text>
            </View>
          }
        />
      )}

      {/* مودال الربط والدمج */}
      <Modal visible={selectedLog !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {isRTL ? "توجيه الاسم البديل للمنطقة" : "Map Naming Alias"}
              </Text>
              <TouchableOpacity onPress={() => setSelectedLog(null)}>
                <VectorIcon name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* حقول تأكيد الأسماء المدخلة لجدول الـ aliases */}
              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                  {isRTL ? "الاسم العامي البديل (عربي)" : "Alternative Alias (Arabic)"}
                </Text>
                <TextInput 
                  value={aliasNameAr}
                  onChangeText={setAliasNameAr}
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                  {isRTL ? "الاسم العامي البديل (إنجليزي)" : "Alternative Alias (English)"}
                </Text>
                <TextInput 
                  value={aliasNameEn}
                  onChangeText={setAliasNameEn}
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                />
              </View>

              {/* منتقي المحافظة والمنطقة لربط الاسم البديل بالـ ID الرسمي */}
              <Text style={[styles.pickerTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "اختر المنطقة الرسمية المقابلة للربط:" : "Select Corresponding Official Area:"}
              </Text>
              <LocationPicker 
                governorateId={govId}
                areaId={areaId}
                onGovernorateChange={setGovId}
                onAreaChange={setAreaId}
                street=""
                onStreetChange={() => {}}
                latitude={selectedLog?.latitude || null}
                longitude={selectedLog?.longitude || null}
                onCoordsChange={() => {}}
                showDetails={false}
              />

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                onPress={handleResolve}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <VectorIcon name="save" size={16} color="#FFF" />
                    <Text style={styles.saveBtnText}>{isRTL ? "حفظ وتصحيح العنونة" : "Save & Correct Mapping"}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  list: { padding: 16 },
  card: { padding: 14, borderWidth: 1.5, borderRadius: 12, marginBottom: 12 },
  cardHeader: { alignItems: "center", gap: 8 },
  flex1: { flex: 1 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  cardCoords: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 4 },
  hitBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  resolveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 8, marginTop: 12, gap: 6 },
  resolveBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, borderWidth: 1 },
  modalHeader: { padding: 16, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  modalBody: { padding: 16, gap: 14 },
  fieldWrap: { gap: 4 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1.5, borderRadius: 8, fontSize: 14 },
  pickerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4, marginBottom: -4 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 10, marginTop: 16, gap: 6 },
  saveBtnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }
});