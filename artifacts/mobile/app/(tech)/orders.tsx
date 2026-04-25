import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Platform, Linking, Alert, Image, ActivityIndicator, Modal } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import { Asset } from "expo-asset";
import { readAsStringAsync } from "expo-file-system/legacy";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders, Order, MaterialItem } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { uploadPhotoToServer } from "@/utils/uploadPhoto";

function getApiBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

export default function TechOrdersScreen() {
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { sessionToken } = useAuth();
  const { getOrdersByTech, updateOrder } = useOrders();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [solutionDesc, setSolutionDesc] = useState("");
  const [satisfaction, setSatisfaction] = useState<"satisfied" | "neutral" | "unsatisfied" | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [matDesc, setMatDesc] = useState("");
  const [matAmount, setMatAmount] = useState("");
  const [matInvoicePhoto, setMatInvoicePhoto] = useState<string | null>(null);
  const [matInvoicePhotoUploading, setMatInvoicePhotoUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [phaseUploading, setPhaseUploading] = useState<Record<string, boolean>>({});
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [afterPhotoUploading, setAfterPhotoUploading] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const orders = getOrdersByTech(user?.id ?? "tech1");
  const activeOrders = orders.filter((o) => ["accepted", "inProgress"].includes(o.status));
  const historyOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));

  const handleShareInvoice = async (order: Order) => {
    if (!order.invoice) return;
    const inv = order.invoice;
    const dir = isRTL ? "rtl" : "ltr";

    let logoDataUri = "";
    try {
      const asset = Asset.fromModule(require("@/assets/images/icon.png"));
      await asset.downloadAsync();
      if (asset.localUri) {
        const base64 = await readAsStringAsync(asset.localUri, { encoding: "base64" });
        logoDataUri = `data:image/png;base64,${base64}`;
      }
    } catch (err) {
      console.warn("[ShareInvoice] Could not load logo asset:", err);
    }

    const logoImg = logoDataUri
      ? `<img src="${logoDataUri}" style="width:48px;height:48px;object-fit:contain;margin-${isRTL ? "left" : "right"}:12px" />`
      : "";

    const rows = [
      [t("invoice.materials"), inv.materialsTotal],
      [t("invoice.materialsMark"), inv.materialsMark],
      [t("invoice.labor"), inv.laborFee],
      [t("invoice.tools"), inv.toolRental],
      [t("invoice.tax"), inv.tax],
      [t("invoice.vat"), inv.vat],
    ]
      .map(
        ([label, val]) =>
          `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:${isRTL ? "left" : "right"};font-weight:500">${val} ${t("common.egp")}</td></tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isRTL ? "ar" : "en"}">
<head>
<meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#111827;direction:${dir}}
  .header{display:flex;flex-direction:${isRTL ? "row-reverse" : "row"};align-items:center;border-bottom:2px solid #f59e0b;padding-bottom:16px;margin-bottom:24px}
  .brand{flex:1;font-size:20px;font-weight:700;color:#111827;text-align:${isRTL ? "right" : "left"}}
  .invoice-num{font-size:12px;color:#6b7280}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  .total-row{background:#fef3c7;font-weight:700;font-size:16px}
  .total-row td{padding:12px;color:#d97706}
  h2{font-size:18px;margin:0 0 16px;text-align:${isRTL ? "right" : "left"}}
</style>
</head>
<body>
<div class="header">
  ${logoImg}
  <div class="brand">${isRTL ? "فني · FANNI" : "FANNI · فني"}</div>
  <div class="invoice-num">#${inv.invoiceNumber}</div>
</div>
<h2>${t("invoice.title")} #${inv.invoiceNumber}</h2>
<table>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td>${t("invoice.total")}</td>
      <td style="text-align:${isRTL ? "left" : "right"}">${inv.total} ${t("common.egp")}</td>
    </tr>
  </tbody>
</table>
</body>
</html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${t("invoice.title")} #${inv.invoiceNumber}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert(t("invoice.title"), uri);
      }
    } catch {
      Alert.alert(t("common.error") || "Error", t("invoice.shareError"));
    }
  };

  const pickInvoicePhoto = async () => {
    if (!sessionToken) {
      Alert.alert(
        isRTL ? "غير مسجّل" : "Not Signed In",
        isRTL ? "يجب تسجيل الدخول لرفع الصور." : "You must be signed in to upload photos."
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setMatInvoicePhotoUploading(true);
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const { url } = await uploadPhotoToServer(asset.uri, sessionToken, mimeType);
      setMatInvoicePhoto(url);
    } catch (_) {
      Alert.alert(
        isRTL ? "فشل الرفع" : "Upload Failed",
        isRTL ? "تعذّر رفع الصورة، يرجى المحاولة مرة أخرى." : "Could not upload photo, please try again."
      );
    } finally {
      setMatInvoicePhotoUploading(false);
    }
  };

  const pickPhasePhoto = async (orderId: string, phase: "before" | "during") => {
    if (!sessionToken) {
      Alert.alert(
        isRTL ? "غير مسجّل" : "Not Signed In",
        isRTL ? "يجب تسجيل الدخول لرفع الصور." : "You must be signed in to upload photos."
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhaseUploading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const { url } = await uploadPhotoToServer(asset.uri, sessionToken, mimeType);
      const apiBase = getApiBaseUrl();
      let savedOnServer = false;
      if (apiBase) {
        const res = await fetch(`${apiBase}/api/orders/${orderId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ phase, urls: [url] }),
        });
        savedOnServer = res.ok;
        if (!res.ok) {
          console.warn(`[Fanni] Phase photo save failed: ${res.status}`);
        }
      }
      if (savedOnServer || !apiBase) {
        const timestamp = new Date().toISOString();
        const newPhoto = { id: `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`, uri: url, phase, timestamp };
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          await updateOrder(orderId, { photos: [...(order.photos ?? []), newPhoto] });
        }
      } else {
        Alert.alert(
          isRTL ? "فشل الحفظ" : "Save Failed",
          isRTL ? "تم رفع الصورة لكن تعذّر حفظها. يرجى المحاولة مرة أخرى." : "Photo uploaded but could not be saved. Please try again."
        );
      }
    } catch {
      Alert.alert(
        isRTL ? "فشل الرفع" : "Upload Failed",
        isRTL ? "تعذّر رفع الصورة، يرجى المحاولة مرة أخرى." : "Could not upload photo, please try again."
      );
    } finally {
      setPhaseUploading((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const pickAfterPhoto = async () => {
    if (!sessionToken) {
      Alert.alert(
        isRTL ? "غير مسجّل" : "Not Signed In",
        isRTL ? "يجب تسجيل الدخول لرفع الصور." : "You must be signed in to upload photos."
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAfterPhotoUploading(true);
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const { url } = await uploadPhotoToServer(asset.uri, sessionToken, mimeType);
      setAfterPhotos((prev) => [...prev, url]);
    } catch {
      Alert.alert(
        isRTL ? "فشل الرفع" : "Upload Failed",
        isRTL ? "تعذّر رفع الصورة، يرجى المحاولة مرة أخرى." : "Could not upload photo, please try again."
      );
    } finally {
      setAfterPhotoUploading(false);
    }
  };

  const addMaterial = () => {
    if (!matDesc || !matAmount) return;
    setMaterials([...materials, { id: Date.now().toString(), description: matDesc, amount: parseFloat(matAmount), invoicePhoto: matInvoicePhoto ?? undefined }]);
    setMatDesc("");
    setMatAmount("");
    setMatInvoicePhoto(null);
  };

  const handleComplete = async (orderId: string) => {
    setLoading(true);
    const matTotal = materials.reduce((sum, m) => sum + m.amount, 0);
    const markup = matTotal * 0.1;
    const labor = 200;
    const tools = 50;
    const tax = (matTotal + markup + labor + tools) * 0.14;
    const vat = (matTotal + markup + labor + tools) * 0.15;
    const total = matTotal + markup + labor + tools + tax + vat;
    const invNum = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const completionPayload = {
      status: "completed" as const,
      solutionDescription: solutionDesc,
      clientSatisfaction: satisfaction ?? "satisfied",
      materials,
      invoice: {
        invoiceNumber: invNum,
        date: new Date().toISOString().split("T")[0],
        materialsTotal: matTotal,
        materialsMark: markup,
        laborFee: labor,
        toolRental: tools,
        tax,
        vat,
        total,
        companyName: "فني للصيانة المنزلية",
        companyPhone: "01000000000",
        orderId,
        clientName: orders.find((o) => o.id === orderId)?.clientName ?? "",
        technicianName: user?.name ?? "",
      },
    };
    let serverSynced = false;
    try {
      const apiBase = getApiBaseUrl();
      if (apiBase && sessionToken) {
        const res = await fetch(`${apiBase}/api/orders/${orderId}/complete`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            solutionDescription: completionPayload.solutionDescription,
            clientSatisfaction: completionPayload.clientSatisfaction,
            materials: completionPayload.materials,
            invoice: completionPayload.invoice,
          }),
        });
        if (res.ok) {
          serverSynced = true;
        } else {
          console.warn(`[Fanni] Failed to complete order on server: ${res.status}`);
        }
        if (afterPhotos.length > 0) {
          await fetch(`${apiBase}/api/orders/${orderId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
            body: JSON.stringify({ phase: "after", urls: afterPhotos }),
          });
        }
      }
    } catch (err) {
      console.warn("[Fanni] Network error completing order:", err);
    }
    if (serverSynced || !sessionToken) {
      const existingOrder = orders.find((o) => o.id === orderId);
      const afterPhotoObjects = afterPhotos.map((url, i) => ({
        id: `photo_after_${Date.now()}_${i}`,
        uri: url,
        phase: "after" as const,
        timestamp: new Date().toISOString(),
      }));
      await updateOrder(orderId, {
        ...completionPayload,
        photos: [...(existingOrder?.photos ?? []), ...afterPhotoObjects],
      });
    }
    setLoading(false);
    setShowComplete(false);
    setSelectedOrderId(null);
    setSolutionDesc("");
    setMaterials([]);
    setSatisfaction(null);
    setAfterPhotos([]);
  };

  const renderCard = ({ item }: { item: Order }) => {
    const isActive = ["accepted", "inProgress"].includes(item.status);
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        <View style={[styles.accentBar, { backgroundColor: isActive ? colors.primary : colors.success }]} />
        <View style={styles.cardBody}>
          <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>{item.orderNumber}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                {t(`cat.${item.category}`)} — {item.subCategory}
              </Text>
            </View>
            <StatusBadge status={item.status} />
          </View>
          <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <VectorIcon name="user" size={12} color={colors.secondary} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, marginLeft: 5, flex: 1 }}>{item.clientName}</Text>
            <VectorIcon name="phone" size={12} color={colors.secondary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4 }}>{item.clientMobile}</Text>
          </View>
          <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <VectorIcon name="map-pin" size={12} color={colors.secondary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 5, flex: 1 }} numberOfLines={1}>
              {item.street}, {t("order.floor")} {item.floor}
            </Text>
            <VectorIcon name="calendar" size={12} color={colors.secondary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4 }}>
              {item.visitDate}
            </Text>
          </View>
          {isActive && (
            <>
              <View style={[styles.actionRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  style={[styles.messageBtn, { backgroundColor: colors.darkMid, borderRadius: colors.radius - 4 }]}
                  onPress={() => Linking.openURL(`sms:${item.clientMobile}`)}
                >
                  <VectorIcon name="message-circle" size={14} color={colors.secondary} />
                  <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>{t("order.messageClient")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.messageBtn, { backgroundColor: colors.darkMid, borderRadius: colors.radius - 4 }]}
                  onPress={() => Linking.openURL(`tel:${item.clientMobile}`)}
                >
                  <VectorIcon name="phone" size={14} color={colors.secondary} />
                  <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 6 }}>{t("order.callClient")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.completeBtn, { backgroundColor: colors.darkMid, borderRadius: colors.radius - 4, flex: 1 }]}
                  onPress={() => { setSelectedOrderId(item.id); setShowComplete(true); }}
                >
                  <VectorIcon name="check-circle" size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13, marginLeft: 6 }}>{t("tech.complete")}</Text>
                </TouchableOpacity>
              </View>
              {/* Phase photo button */}
              {item.status === "accepted" && (
                <TouchableOpacity
                  style={[styles.phasePhotoBtn, { borderColor: colors.secondary, borderRadius: colors.radius - 4, opacity: phaseUploading[item.id] ? 0.6 : 1 }]}
                  onPress={() => pickPhasePhoto(item.id, "before")}
                  disabled={!!phaseUploading[item.id]}
                >
                  {phaseUploading[item.id] ? (
                    <ActivityIndicator size="small" color={colors.secondary} />
                  ) : (
                    <VectorIcon name="camera" size={14} color={colors.secondary} />
                  )}
                  <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 6 }}>
                    {phaseUploading[item.id] ? t("photo.uploading") : t("photo.addBefore")}
                  </Text>
                </TouchableOpacity>
              )}
              {item.status === "inProgress" && (
                <TouchableOpacity
                  style={[styles.phasePhotoBtn, { borderColor: colors.primary, borderRadius: colors.radius - 4, opacity: phaseUploading[item.id] ? 0.6 : 1 }]}
                  onPress={() => pickPhasePhoto(item.id, "during")}
                  disabled={!!phaseUploading[item.id]}
                >
                  {phaseUploading[item.id] ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <VectorIcon name="camera" size={14} color={colors.primary} />
                  )}
                  <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 6 }}>
                    {phaseUploading[item.id] ? t("photo.uploading") : t("photo.addDuring")}
                  </Text>
                </TouchableOpacity>
              )}
              {/* Per-phase photo counts (all phases) */}
              {(() => {
                const photos = item.photos ?? [];
                const counts: { phase: string; icon: string; labelAr: string; labelEn: string; color: string }[] = [
                  { phase: "problem", icon: "alert-circle", labelAr: "مشكلة", labelEn: "problem", color: colors.destructive },
                  { phase: "before",  icon: "eye",          labelAr: "قبل",    labelEn: "before",  color: colors.secondary },
                  { phase: "during",  icon: "tool",         labelAr: "أثناء",  labelEn: "during",  color: colors.primary },
                  { phase: "after",   icon: "check-circle", labelAr: "بعد",    labelEn: "after",   color: colors.success },
                ].map((p) => ({ ...p, count: photos.filter((ph) => (ph.phase ?? "problem") === p.phase).length }))
                  .filter((p) => p.count > 0);
                if (!counts.length) return null;
                return (
                  <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap", gap: 8, marginTop: 6 }]}>
                    {counts.map((c) => (
                      <View key={c.phase} style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 3 }]}>
                        <VectorIcon name={c.icon} size={11} color={c.color} />
                        <Text style={{ color: c.color, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                          {c.count} {isRTL ? c.labelAr : c.labelEn}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
              {/* Active card: before/during thumbnail strip */}
              {(item.photos ?? []).filter((p) => p.phase === "before" || p.phase === "during").length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {(item.photos ?? []).filter((p) => p.phase === "before" || p.phase === "during").map((ph) => (
                    <TouchableOpacity key={ph.id} onPress={() => setLightboxUri(ph.uri)}>
                      <Image source={{ uri: ph.uri }} style={styles.miniThumb} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          )}
          {item.status === "completed" && item.invoice && (
            <View style={{ marginTop: 8, gap: 8 }}>
              <View style={[styles.invoiceSummary, { backgroundColor: colors.accent, borderRadius: colors.radius - 4 }]}>
                <VectorIcon name="file-text" size={13} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 6 }}>
                  {t("invoice.total")}: {item.invoice.total.toFixed(0)} {t("common.egp")}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.darkMid, borderRadius: colors.radius - 4, flexDirection: isRTL ? "row-reverse" : "row" }]}
                onPress={() => handleShareInvoice(item)}
                activeOpacity={0.8}
              >
                <VectorIcon name="share-2" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                  {t("invoice.share")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Four-phase gallery for completed orders */}
          {item.status === "completed" && (item.photos ?? []).length > 0 && (() => {
            const phaseDef = [
              { phase: "problem", icon: "alert-circle", labelAr: "صور المشكلة", labelEn: "Problem Photos", color: colors.destructive },
              { phase: "before",  icon: "eye",          labelAr: "قبل البدء",   labelEn: "Before Work",    color: colors.secondary },
              { phase: "during",  icon: "tool",         labelAr: "أثناء العمل", labelEn: "During Work",    color: colors.primary },
              { phase: "after",   icon: "check-circle", labelAr: "بعد الإنهاء", labelEn: "After Work",     color: colors.success },
            ];
            const groups = phaseDef
              .map((p) => ({ ...p, photos: (item.photos ?? []).filter((ph) => (ph.phase ?? "problem") === p.phase) }))
              .filter((g) => g.photos.length > 0);
            if (!groups.length) return null;
            return (
              <View style={[styles.completedGallery, { borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 8, textAlign: isRTL ? "right" : "left" }}>
                  {t("photo.gallery")}
                </Text>
                {groups.map((g) => {
                  const collapsed = collapsedPhases[`${item.id}_${g.phase}`] ?? false;
                  return (
                    <View key={g.phase} style={{ marginBottom: 8 }}>
                      <TouchableOpacity
                        style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, borderBottomColor: colors.border, borderBottomWidth: collapsed ? 0 : 1 }]}
                        onPress={() => setCollapsedPhases((prev) => ({ ...prev, [`${item.id}_${g.phase}`]: !collapsed }))}
                        activeOpacity={0.75}
                      >
                        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 5, flex: 1 }}>
                          <VectorIcon name={g.icon} size={12} color={g.color} />
                          <Text style={{ color: g.color, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                            {isRTL ? g.labelAr : g.labelEn}
                          </Text>
                          <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: colors.accent }}>
                            <Text style={{ color: g.color, fontFamily: "Inter_700Bold", fontSize: 11 }}>{g.photos.length}</Text>
                          </View>
                        </View>
                        <VectorIcon name={collapsed ? "chevron-down" : "chevron-up"} size={13} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      {!collapsed && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                          {g.photos.map((ph) => (
                            <TouchableOpacity key={ph.id} onPress={() => setLightboxUri(ph.uri)}>
                              <Image source={{ uri: ph.uri }} style={styles.miniThumb} />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>
      </View>
    );
  };

  if (showComplete && selectedOrderId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("tech.complete")} showBack onBack={() => setShowComplete(false)} />
        <ScrollView contentContainerStyle={[styles.completeContent, { paddingBottom: botPad + 24 }]} keyboardShouldPersistTaps="handled">
          {/* Materials */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>{t("tech.materials")}</Text>
            {materials.map((m) => (
              <View key={m.id} style={[styles.matItem, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                {m.invoicePhoto ? (
                  <Image source={{ uri: m.invoicePhoto }} style={{ width: 32, height: 32, borderRadius: 4, marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0 }} />
                ) : null}
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 }}>{m.description}</Text>
                <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{m.amount} {t("common.egp")}</Text>
                <TouchableOpacity onPress={() => setMaterials(materials.filter((x) => x.id !== m.id))} style={{ marginLeft: 10 }}>
                  <VectorIcon name="trash-2" size={14} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={[styles.matForm, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <FanniInput placeholder={isRTL ? "الوصف" : "Description"} value={matDesc} onChangeText={setMatDesc} style={{ flex: 2, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0, marginBottom: 0 }} />
              <FanniInput placeholder={isRTL ? "المبلغ" : "Amount"} value={matAmount} onChangeText={setMatAmount} keyboardType="numeric" style={{ flex: 1, marginBottom: 0 }} />
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: 10 }]} onPress={addMaterial}>
                <VectorIcon name="plus" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            {/* Invoice receipt photo for current material being added */}
            <TouchableOpacity
              onPress={matInvoicePhoto ? () => setMatInvoicePhoto(null) : pickInvoicePhoto}
              disabled={matInvoicePhotoUploading}
              style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginTop: 8, padding: 8, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 8, backgroundColor: colors.accent }}
            >
              {matInvoicePhotoUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : matInvoicePhoto ? (
                <>
                  <Image source={{ uri: matInvoicePhoto }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
                  <Text style={{ color: colors.destructive, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                    {isRTL ? "إزالة صورة الفاتورة" : "Remove receipt photo"}
                  </Text>
                </>
              ) : (
                <>
                  <VectorIcon name="camera" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                    {isRTL ? "إضافة صورة فاتورة (اختياري)" : "Add receipt photo (optional)"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Solution */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>{t("tech.solutionDesc")}</Text>
            <FanniInput value={solutionDesc} onChangeText={setSolutionDesc} multiline numberOfLines={4} placeholder={isRTL ? "اشرح الحل الذي تم..." : "Describe the solution applied..."} />
          </View>

          {/* Satisfaction */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>{t("tech.clientSatisfied")}</Text>
            {(["satisfied", "neutral", "unsatisfied"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.satisfactionOption, { borderColor: satisfaction === s ? colors.primary : colors.border, backgroundColor: satisfaction === s ? colors.accent : colors.background, borderRadius: colors.radius - 4, flexDirection: isRTL ? "row-reverse" : "row" }]}
                onPress={() => setSatisfaction(s)}
              >
                <VectorIcon name={s === "satisfied" ? "smile" : s === "neutral" ? "meh" : "frown"} size={20} color={satisfaction === s ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: satisfaction === s ? colors.primary : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14, marginLeft: 10 }}>
                  {t(`tech.${s}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* After completion photos */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>{t("photo.phase.after")}</Text>
            {afterPhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {afterPhotos.map((url, i) => (
                  <TouchableOpacity key={i} onPress={() => setLightboxUri(url)}>
                    <Image source={{ uri: url }} style={styles.afterThumb} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              onPress={pickAfterPhoto}
              disabled={afterPhotoUploading}
              style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", padding: 10, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 8, backgroundColor: colors.accent }}
            >
              {afterPhotoUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <VectorIcon name="camera" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                    {t("photo.addAfter")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <FanniButton
            title={isRTL ? "إنهاء وإصدار الفاتورة" : "Complete & Generate Invoice"}
            onPress={() => handleComplete(selectedOrderId)}
            loading={loading}
            fullWidth
            style={{ marginHorizontal: 16 }}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          {lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUri(null)}>
            <VectorIcon name="x" size={22} color="#FFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <AppHeader
        title={t("nav.orders")}
        subtitle={`${activeOrders.length} ${isRTL ? "طلبات نشطة" : "active"}`}
      />
      <FlatList
        data={[...activeOrders, ...historyOrders]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
        ListHeaderComponent={
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, paddingBottom: 8, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "الطلبات الحالية والسابقة" : "Current & Past Orders"}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 36 }]}>
              <VectorIcon name="inbox" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 15, marginTop: 12, textAlign: "center", fontFamily: "Inter_400Regular" }}>{t("common.noData")}</Text>
          </View>
        }
        renderItem={renderCard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  card: { marginBottom: 12, borderWidth: 1.5, flexDirection: "row", overflow: "hidden" },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { alignItems: "flex-start", marginBottom: 8, gap: 8 },
  infoRow: { alignItems: "center", marginBottom: 6, gap: 0 },
  actionRow: { marginTop: 8, gap: 8 },
  messageBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10 },
  completeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10 },
  invoiceSummary: { flexDirection: "row", alignItems: "center", padding: 10 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  completeContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  section: { padding: 16, borderWidth: 1.5 },
  sectionTitle: { fontSize: 16, marginBottom: 14 },
  matItem: { paddingVertical: 8, borderBottomWidth: 1, alignItems: "center", marginBottom: 4 },
  matForm: { marginTop: 12, alignItems: "center", gap: 8 },
  addBtn: { padding: 12 },
  satisfactionOption: { padding: 14, marginBottom: 10, borderWidth: 1.5, alignItems: "center" },
  phasePhotoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 9, marginTop: 8, borderWidth: 1.5, borderStyle: "dashed" },
  completedGallery: { marginTop: 8, padding: 10, borderWidth: 1, borderRadius: 8 },
  miniThumb: { width: 48, height: 48, borderRadius: 6, marginRight: 6 },
  afterThumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8 },
  lightboxOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  lightboxImage: { width: "100%", height: "80%" },
  lightboxClose: { position: "absolute", top: 48, right: 20, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 8 },
});
