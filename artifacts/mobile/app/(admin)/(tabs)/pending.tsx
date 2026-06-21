import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Modal, ScrollView, RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import VectorIcon from "@/components/VectorIcon";
import { getApiBase } from "@/utils/api";

interface PendingTech {
  id: string;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  profession: string | null;
  specialty: string | null;
  governorate: string | null;
  area: string | null;
  nationalIdFrontUrl: string | null;
  nationalIdBackUrl: string | null;
  licenseCardUrl: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  createdAt: string;
}

async function fetchPending(token: string): Promise<PendingTech[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/admin/technicians/pending?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load");
  const data = await res.json() as { technicians: PendingTech[] };
  return data.technicians ?? [];
}

async function approveReject(token: string, id: string, action: "approve" | "reject", reason?: string) {
  const base = getApiBase();
  const url = `${base}/api/admin/technicians/${id}/${action}`;
  const body = action === "reject" ? JSON.stringify({ reason }) : undefined;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body,
  });
  if (!res.ok) throw new Error(`Failed to ${action}`);
}

export default function PendingTechniciansScreen() {
  const colors = useColors();
  const { isRTL } = useApp();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [techs, setTechs] = useState<PendingTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<PendingTech | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!sessionToken) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const list = await fetchPending(sessionToken);
      setTechs(list);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAction = async (tech: PendingTech, action: "approve" | "reject") => {
    if (!sessionToken) return;

    const name = [tech.firstName, tech.lastName].filter(Boolean).join(" ") || tech.mobile || "هذا الفني";
    const confirmMsg = action === "approve"
      ? (isRTL ? `هل تريد قبول ${name}؟` : `Approve ${name}?`)
      : (isRTL ? `هل تريد رفض ${name}؟ سيتم إلغاء تفعيل حسابه.` : `Reject ${name}? Their account will be deactivated.`);

    Alert.alert(
      isRTL ? (action === "approve" ? "قبول الفني" : "رفض الفني") : (action === "approve" ? "Approve Technician" : "Reject Technician"),
      confirmMsg,
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? (action === "approve" ? "قبول" : "رفض") : (action === "approve" ? "Approve" : "Reject"),
          style: action === "reject" ? "destructive" : "default",
          onPress: async () => {
            setActionLoading(true);
            try {
              await approveReject(sessionToken, tech.id, action, action === "reject" ? "Admin review" : undefined);
              setTechs((prev) => prev.filter((t) => t.id !== tech.id));
              if (selected?.id === tech.id) setSelected(null);
            } catch {
              Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "تعذّر تنفيذ العملية" : "Operation failed");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const renderCard = ({ item }: { item: PendingTech }) => {
    const fullName = [item.firstName, item.lastName].filter(Boolean).join(" ") || "—";
    const hasPhotos = item.nationalIdFrontUrl || item.nationalIdBackUrl || item.licenseCardUrl;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
        onPress={() => setSelected(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={{ fontSize: 20 }}>🔧</Text>
          </View>
          <View style={{ flex: 1, marginLeft: isRTL ? 0 : 12, marginRight: isRTL ? 12 : 0 }}>
            <Text style={[styles.name, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{fullName}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
              {item.mobile} {item.profession ? `· ${item.profession}` : ""}
            </Text>
            {item.governorate && (
              <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                📍 {item.governorate}{item.area ? ` · ${item.area}` : ""}
              </Text>
            )}
          </View>
          {hasPhotos && (
            <View style={[styles.photoBadge, { backgroundColor: colors.primary }]}>
              <VectorIcon name="image" size={12} color="#fff" />
            </View>
          )}
        </View>

        <View style={[styles.cardActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleAction(item, "approve")}
            disabled={actionLoading}
          >
            <VectorIcon name="check" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>{isRTL ? "قبول" : "Approve"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, { borderColor: colors.destructive }]}
            onPress={() => handleAction(item, "reject")}
            disabled={actionLoading}
          >
            <VectorIcon name="x" size={14} color={colors.destructive} />
            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>{isRTL ? "رفض" : "Reject"}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "فنيون بانتظار الموافقة" : "Pending Technicians"}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{techs.length}</Text>
        </View>
      </View>

      {techs.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 16, textAlign: "center" }}>
            {isRTL ? "لا يوجد فنيون بانتظار الموافقة" : "No pending technicians"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={techs}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent={false} onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 8, flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <VectorIcon name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {isRTL ? "تفاصيل الفني" : "Technician Details"}
              </Text>
              <View style={{ width: 22 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
              {/* Basic Info */}
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "البيانات الشخصية" : "Personal Info"}
              </Text>
              {[
                { label: isRTL ? "الاسم" : "Name", value: [selected.firstName, selected.lastName].filter(Boolean).join(" ") || "—" },
                { label: isRTL ? "الهاتف" : "Mobile", value: selected.mobile || "—" },
                { label: isRTL ? "المهنة" : "Profession", value: selected.profession || "—" },
                { label: isRTL ? "التخصص" : "Specialty", value: selected.specialty || "—" },
                { label: isRTL ? "سنوات الخبرة" : "Experience", value: selected.yearsOfExperience != null ? `${selected.yearsOfExperience} ${isRTL ? "سنة" : "yrs"}` : "—" },
                { label: isRTL ? "المحافظة" : "Governorate", value: selected.governorate || "—" },
                { label: isRTL ? "المنطقة" : "Area", value: selected.area || "—" },
              ].map((row) => (
                <View key={row.label} style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground, textAlign: isRTL ? "left" : "right" }]}>{row.value}</Text>
                </View>
              ))}

              {selected.bio && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "نبذة شخصية" : "Bio"}
                  </Text>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: isRTL ? "right" : "left", lineHeight: 22 }}>
                    {selected.bio}
                  </Text>
                </View>
              )}

              {/* Documents */}
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left", marginTop: 8 }]}>
                {isRTL ? "الوثائق" : "Documents"}
              </Text>

              {[
                { label: isRTL ? "وجه البطاقة" : "ID Front", url: selected.nationalIdFrontUrl },
                { label: isRTL ? "ظهر البطاقة" : "ID Back", url: selected.nationalIdBackUrl },
                { label: isRTL ? "كارنيه المهنة" : "License Card", url: selected.licenseCardUrl },
              ].map((doc) => (
                <View key={doc.label} style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 8, textAlign: isRTL ? "right" : "left" }}>
                    {doc.label}
                  </Text>
                  {doc.url ? (
                    <TouchableOpacity onPress={() => setPhotoModal(doc.url!)}>
                      <Image
                        source={{ uri: doc.url }}
                        style={[styles.docImage, { borderColor: colors.border, borderRadius: colors.radius }]}
                        resizeMode="cover"
                      />
                      <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "center", marginTop: 4 }}>
                        {isRTL ? "اضغط للتكبير" : "Tap to enlarge"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.noDoc, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}>
                      <VectorIcon name="image" size={24} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6 }}>
                        {isRTL ? "لم يتم رفع صورة" : "No photo uploaded"}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Action Buttons */}
              <View style={[styles.modalActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  style={[styles.bigActionBtn, { backgroundColor: colors.primary, flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }]}
                  onPress={() => handleAction(selected, "approve")}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <VectorIcon name="check" size={18} color="#fff" />
                      <Text style={[styles.bigActionBtnText, { color: "#fff" }]}>{isRTL ? "قبول الفني" : "Approve"}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bigActionBtn, { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.destructive, flex: 1 }]}
                  onPress={() => handleAction(selected, "reject")}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color={colors.destructive} size="small" /> : (
                    <>
                      <VectorIcon name="x" size={18} color={colors.destructive} />
                      <Text style={[styles.bigActionBtnText, { color: colors.destructive }]}>{isRTL ? "رفض الفني" : "Reject"}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Full screen photo viewer */}
      <Modal visible={!!photoModal} animationType="fade" transparent onRequestClose={() => setPhotoModal(null)}>
        <TouchableOpacity style={styles.photoViewer} activeOpacity={1} onPress={() => setPhotoModal(null)}>
          {photoModal && (
            <Image source={{ uri: photoModal }} style={styles.photoViewerImg} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.closePhotoBtn} onPress={() => setPhotoModal(null)}>
            <VectorIcon name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 20 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: "center" },
  badgeText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 },
  card: { padding: 16, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { alignItems: "flex-start", marginBottom: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 3 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  photoBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  cardActions: { gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  approveBtn: { backgroundColor: "#16A34A" },
  rejectBtn: { backgroundColor: "transparent", borderWidth: 1.5 },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  modalRoot: { flex: 1 },
  modalHeader: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 12 },
  modalTitle: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, marginTop: 4 },
  infoRow: { paddingVertical: 12, borderBottomWidth: 1, alignItems: "center" },
  infoLabel: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  infoValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  docImage: { width: "100%", height: 180, borderWidth: 1 },
  noDoc: { height: 100, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  modalActions: { marginTop: 24, gap: 10 },
  bigActionBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bigActionBtnText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  photoViewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  photoViewerImg: { width: "95%", height: "80%" },
  closePhotoBtn: { position: "absolute", top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});
