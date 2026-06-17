import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Platform, Linking, Alert, Image, ActivityIndicator, Modal, TextInput, LayoutAnimation, UIManager, Animated } from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { shareTechPayoutInvoicePdf, shareLegacyInvoicePdf } from "@/utils/invoicePdf";
import VectorIcon, { type IconName } from "@/components/VectorIcon";
import SUB_IMAGE_MAP from "@/constants/subImageMap";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders, Order, OcrReceiptData } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";
import FanniInput from "@/components/FanniInput";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { uploadPhotoToServer } from "@/utils/uploadPhoto";
import { pickPhotoWithSourceChooser } from "@/utils/pickPhoto";
import { getApiBase } from "@/utils/api";


const SERVICE_FEE_RATE = 15;
const VAT_RATE = 14;

interface ServerInvoiceSummary {
  techNetTotal?: number;
  clientTotal?: number;
  adminTotal?: number;
  serviceFeeAmount?: number;
  vatAmount?: number;
  labourFee?: number;
  transportFee?: number;
  materialsTotal?: number;
}

interface CompleteOrderResponse {
  invoices?: ServerInvoiceSummary;
}

function computePreview(labourFee: number, transportFee: number, materialsTotal: number) {
  const serviceFeeAmount = (labourFee * SERVICE_FEE_RATE) / 100;
  const vatAmount = (labourFee * VAT_RATE) / 100;
  const base = materialsTotal + transportFee + labourFee;
  const techNetTotal = base - serviceFeeAmount;
  const clientTotal = base + serviceFeeAmount + vatAmount;
  return { serviceFeeAmount, vatAmount, base, techNetTotal, clientTotal };
}

export default function TechOrdersScreen() {
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { sessionToken } = useAuth();
  const { getOrdersByTech, updateOrder, syncOrders, wsOrderStatusSignal, markCompletedOrdersSeen, ordersTabFocusedRef } = useOrders();
  const insets = useSafeAreaInsets();
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [solutionDesc, setSolutionDesc] = useState("");
  const [satisfaction, setSatisfaction] = useState<"satisfied" | "neutral" | "unsatisfied" | null>(null);

  const [receiptPhotos, setReceiptPhotos] = useState<OcrReceiptData[]>([]);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [labourFeeStr, setLabourFeeStr] = useState("");
  const [transportFeeStr, setTransportFeeStr] = useState("");
  const [materialsTotalStr, setMaterialsTotalStr] = useState("0");
  const [ocrRunning, setOcrRunning] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [phaseUploading, setPhaseUploading] = useState<Record<string, boolean>>({});
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [afterPhotoUploading, setAfterPhotoUploading] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  const isFetchingRef = useRef(false);
  const [updatedOrderIds, setUpdatedOrderIds] = useState<Set<string>>(new Set());
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const clearUpdatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashUpdatedBadges = useCallback((ids: Set<string>) => {
    if (ids.size === 0) return;
    if (clearUpdatedTimerRef.current) clearTimeout(clearUpdatedTimerRef.current);
    setUpdatedOrderIds((prev) => new Set([...prev, ...ids]));
    badgeOpacity.setValue(1);
    clearUpdatedTimerRef.current = setTimeout(() => {
      Animated.timing(badgeOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setUpdatedOrderIds(new Set());
        badgeOpacity.setValue(0);
      });
    }, 1500);
  }, [badgeOpacity]);

  const fetchOrdersFromApi = useCallback(async (detectChanges = false) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await fetch(`${apiBase}/api/technician/orders`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { orders: unknown[] };
      if (Array.isArray(json.orders)) {
        const fetched = json.orders as Order[];

        if (detectChanges && prevStatusMapRef.current.size > 0) {
          const changed = new Set<string>();
          for (const order of fetched) {
            const prev = prevStatusMapRef.current.get(order.id);
            if (prev !== undefined && prev !== order.status) {
              changed.add(order.id);
            }
          }
          flashUpdatedBadges(changed);
        }

        prevStatusMapRef.current = new Map(fetched.map((o) => [o.id, o.status]));
        syncOrders(fetched as Parameters<typeof syncOrders>[0]);
      }
    } catch (err) {
      console.warn("[Fanni] Failed to re-fetch tech orders:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [sessionToken, syncOrders, flashUpdatedBadges]);

  useEffect(() => {
    return () => {
      if (clearUpdatedTimerRef.current) clearTimeout(clearUpdatedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (wsOrderStatusSignal === 0) return;
    const timer = setTimeout(() => {
      fetchOrdersFromApi(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [wsOrderStatusSignal, fetchOrdersFromApi]);

  useFocusEffect(
    useCallback(() => {
      ordersTabFocusedRef.current = true;
      markCompletedOrdersSeen();
      fetchOrdersFromApi();
      return () => {
        ordersTabFocusedRef.current = false;
      };
    }, [fetchOrdersFromApi, markCompletedOrdersSeen, ordersTabFocusedRef])
  );

  const orders = getOrdersByTech(user?.id ?? "tech1");
  const activeOrders = orders.filter((o) => ["accepted", "inProgress"].includes(o.status));
  const historyOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));

  const labourFee = parseFloat(labourFeeStr) || 0;
  const transportFee = parseFloat(transportFeeStr) || 0;
  const materialsTotal = parseFloat(materialsTotalStr) || 0;
  const preview = computePreview(labourFee, transportFee, materialsTotal);

  const handleShareInvoice = async (order: Order) => {
    if (order.threePartyInvoice) {
      await shareTechPayoutInvoicePdf({ order, isRTL, t });
      return;
    }
    await shareLegacyInvoicePdf({ order, isRTL, t });
  };

  const runOCR = async (imageUrl: string): Promise<OcrReceiptData | null> => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return null;
    setOcrRunning(true);
    try {
      const res = await fetch(`${apiBase}/api/ocr/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ imageUrl }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { supplier?: string | null; date?: string | null; lineItems?: Array<{ description: string; qty: number; unit?: string | null; unitPrice: number; totalPrice: number }>; detectedTotal?: number };
      return {
        supplier: data.supplier ?? null,
        date: data.date ?? null,
        lineItems: data.lineItems ?? [],
        detectedTotal: data.detectedTotal ?? 0,
        photoUrl: imageUrl,
      };
    } catch {
      return null;
    } finally {
      setOcrRunning(false);
    }
  };

  const pickReceiptPhoto = async () => {
    if (!sessionToken) {
      Alert.alert(
        isRTL ? "غير مسجّل" : "Not Signed In",
        isRTL ? "يجب تسجيل الدخول لرفع الصور." : "You must be signed in to upload photos."
      );
      return;
    }
    const asset = await pickPhotoWithSourceChooser(isRTL);
    if (!asset) return;
    setReceiptUploading(true);
    setReceiptError(null);
    try {
      const { url } = await uploadPhotoToServer(asset.uri, sessionToken, asset.mimeType);
      const ocrData = await runOCR(url);
      const receipt: OcrReceiptData = ocrData ?? { supplier: null, date: null, lineItems: [], detectedTotal: 0, photoUrl: url };
      setReceiptPhotos((prev) => {
        const updated = [...prev, receipt];
        const newTotal = updated.reduce((sum, r) => sum + r.detectedTotal, 0);
        setMaterialsTotalStr(newTotal > 0 ? newTotal.toFixed(2) : materialsTotalStr);
        return updated;
      });
    } catch {
      Alert.alert(
        isRTL ? "فشل الرفع" : "Upload Failed",
        isRTL ? "تعذّر رفع الصورة، يرجى المحاولة مرة أخرى." : "Could not upload photo, please try again."
      );
    } finally {
      setReceiptUploading(false);
    }
  };

  const pickPhasePhoto = async (orderId: string, phase: "before" | "during") => {
    if (!sessionToken) {
      Alert.alert(isRTL ? "غير مسجّل" : "Not Signed In", isRTL ? "يجب تسجيل الدخول لرفع الصور." : "You must be signed in to upload photos.");
      return;
    }
    const asset = await pickPhotoWithSourceChooser(isRTL);
    if (!asset) return;
    setPhaseUploading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const { url } = await uploadPhotoToServer(asset.uri, sessionToken, asset.mimeType);
      const apiBase = getApiBase();
      let savedOnServer = false;
      if (apiBase) {
        const res = await fetch(`${apiBase}/api/orders/${orderId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ phase, urls: [url] }),
        });
        savedOnServer = res.ok;
      }
      if (savedOnServer || !apiBase) {
        const timestamp = new Date().toISOString();
        const newPhoto = { id: `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`, uri: url, phase, timestamp };
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          await updateOrder(orderId, { photos: [...(order.photos ?? []), newPhoto] });
        }
      } else {
        Alert.alert(isRTL ? "فشل الحفظ" : "Save Failed", isRTL ? "تم رفع الصورة لكن تعذّر حفظها." : "Photo uploaded but could not be saved.");
      }
    } catch {
      Alert.alert(isRTL ? "فشل الرفع" : "Upload Failed", isRTL ? "تعذّر رفع الصورة." : "Could not upload photo.");
    } finally {
      setPhaseUploading((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const pickAfterPhoto = async () => {
    if (!sessionToken) {
      Alert.alert(isRTL ? "غير مسجّل" : "Not Signed In", isRTL ? "يجب تسجيل الدخول لرفع الصور." : "You must be signed in to upload photos.");
      return;
    }
    const asset = await pickPhotoWithSourceChooser(isRTL);
    if (!asset) return;
    setAfterPhotoUploading(true);
    try {
      const { url } = await uploadPhotoToServer(asset.uri, sessionToken, asset.mimeType);
      setAfterPhotos((prev) => [...prev, url]);
    } catch {
      Alert.alert(isRTL ? "فشل الرفع" : "Upload Failed", isRTL ? "تعذّر رفع الصورة." : "Could not upload photo.");
    } finally {
      setAfterPhotoUploading(false);
    }
  };

  const handleComplete = async (orderId: string) => {
    if (receiptPhotos.length === 0) {
      setReceiptError(isRTL ? "يجب رفع صورة فاتورة مواد واحدة على الأقل" : "At least one material receipt photo is required");
      return;
    }
    if (labourFee <= 0) {
      Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "يرجى إدخال أجر العمالة" : "Please enter the labour fee");
      return;
    }
    setLoading(true);

    const materialPhotos = receiptPhotos.map((r) => r.photoUrl);
    const ocrLineItems = receiptPhotos.map((r) => ({
      supplier: r.supplier,
      date: r.date,
      items: r.lineItems.map((li) => ({ description: li.description, qty: li.qty, unit: li.unit, unitPrice: li.unitPrice, totalPrice: li.totalPrice })),
      detectedTotal: r.detectedTotal,
    }));

    const { serviceFeeAmount, vatAmount, techNetTotal, clientTotal } = preview;
    const adminTotal = serviceFeeAmount * 2 + vatAmount;

    let serverSynced = false;
    let serverInvoices: ServerInvoiceSummary | null = null;
    let afterPhotosSaved = false;

    try {
      const apiBase = getApiBase();
      if (apiBase && sessionToken) {
        const res = await fetch(`${apiBase}/api/orders/${orderId}/complete`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({
            solutionDescription: solutionDesc,
            clientSatisfaction: satisfaction ?? "satisfied",
            labourFee,
            transportFee: transportFee || undefined,
            materialsTotal,
            materialPhotos,
            ocrLineItems,
          }),
        });
        if (res.ok) {
          serverSynced = true;
          const data = await res.json() as CompleteOrderResponse;
          serverInvoices = data.invoices ?? null;
        } else {
          console.warn(`[Fanni] Failed to complete order on server: ${res.status}`);
        }
        if (afterPhotos.length > 0) {
          const photoRes = await fetch(`${apiBase}/api/orders/${orderId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
            body: JSON.stringify({ phase: "after", urls: afterPhotos }),
          });
          afterPhotosSaved = photoRes.ok;
        } else {
          afterPhotosSaved = true;
        }
      } else {
        afterPhotosSaved = true;
      }
    } catch (err) {
      console.warn("[Fanni] Network error completing order:", err);
    }

    if (serverSynced || !sessionToken) {
      const existingOrder = orders.find((o) => o.id === orderId);
      const afterPhotoObjects =
        afterPhotosSaved && afterPhotos.length > 0
          ? afterPhotos.map((url, i) => ({
              id: `photo_after_${Date.now()}_${i}`,
              uri: url,
              phase: "after" as const,
              timestamp: new Date().toISOString(),
            }))
          : [];
      await updateOrder(orderId, {
        status: "completed" as const,
        solutionDescription: solutionDesc,
        clientSatisfaction: satisfaction ?? "satisfied",
        photos: [...(existingOrder?.photos ?? []), ...afterPhotoObjects],
        threePartyInvoice: {
          labourFee,
          transportFee,
          materialsTotal,
          serviceFeeRate: SERVICE_FEE_RATE,
          serviceFeeAmount: serverInvoices?.serviceFeeAmount ?? serviceFeeAmount,
          vatRate: VAT_RATE,
          vatAmount: serverInvoices?.vatAmount ?? vatAmount,
          techNetTotal: serverInvoices?.techNetTotal ?? techNetTotal,
          clientTotal: serverInvoices?.clientTotal ?? clientTotal,
          adminTotal: serverInvoices?.adminTotal ?? adminTotal,
          receiptPhotos: materialPhotos,
          ocrLineItems: receiptPhotos,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    setLoading(false);
    setShowComplete(false);
    setSelectedOrderId(null);
    setSolutionDesc("");
    setSatisfaction(null);
    setAfterPhotos([]);
    setReceiptPhotos([]);
    setLabourFeeStr("");
    setTransportFeeStr("");
    setMaterialsTotalStr("0");
    setReceiptError(null);
  };

  const handleCancelComplete = () => {
    setShowComplete(false);
    setSelectedOrderId(null);
    setSolutionDesc("");
    setSatisfaction(null);
    setAfterPhotos([]);
    setReceiptPhotos([]);
    setLabourFeeStr("");
    setTransportFeeStr("");
    setMaterialsTotalStr("0");
    setReceiptError(null);
  };

  const renderCard = ({ item }: { item: Order }) => {
    const isActive = ["accepted", "inProgress"].includes(item.status);
    const isUpdated = updatedOrderIds.has(item.id);
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: isUpdated ? "#F59E0B" : colors.border }]}>
        <View style={[styles.accentBar, { backgroundColor: isActive ? colors.primary : colors.success }]} />
        <View style={styles.cardBody}>
          {isUpdated && (
            <Animated.View style={[styles.updatedBadge, { opacity: badgeOpacity, alignSelf: isRTL ? "flex-start" : "flex-end" }]}>
              <Text style={styles.updatedBadgeText}>✦ {t("order.updated")}</Text>
            </Animated.View>
          )}
          <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {item.subImageKey && SUB_IMAGE_MAP[item.subImageKey] && (
              <Image
                source={SUB_IMAGE_MAP[item.subImageKey]}
                style={[styles.subThumb, { borderRadius: colors.radius - 4, borderColor: colors.border }]}
                resizeMode="cover"
              />
            )}
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
              {(() => {
                const photos = item.photos ?? [];
                const phaseItems: { phase: string; icon: IconName; labelAr: string; labelEn: string; color: string }[] = [
                  { phase: "problem", icon: "alert-circle", labelAr: "مشكلة", labelEn: "problem", color: colors.destructive },
                  { phase: "before",  icon: "eye",          labelAr: "قبل",    labelEn: "before",  color: colors.secondary },
                  { phase: "during",  icon: "tool",         labelAr: "أثناء",  labelEn: "during",  color: colors.primary },
                  { phase: "after",   icon: "check-circle", labelAr: "بعد",    labelEn: "after",   color: colors.success },
                ];
                const counts = phaseItems.map((p) => ({ ...p, count: photos.filter((ph) => (ph.phase ?? "problem") === p.phase).length }))
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
          {item.status === "completed" && (item.threePartyInvoice || item.invoice) && (() => {
            const invoiceExpanded = expandedInvoices[item.id] ?? false;
            const inv3 = item.threePartyInvoice;
            const invLegacy = item.invoice;
            const displayTotal = inv3 ? inv3.techNetTotal : (invLegacy?.total ?? 0);
            const displayNum = invLegacy?.invoiceNumber ?? (isRTL ? "فاتورة" : "Invoice");
            return (
              <View style={[styles.invoiceBlock, { borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <TouchableOpacity
                  style={[styles.invoiceLogoRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: invoiceExpanded ? colors.border : "transparent" }]}
                  onPress={() => setExpandedInvoices((prev) => ({ ...prev, [item.id]: !invoiceExpanded }))}
                  activeOpacity={0.75}
                >
                  <Image source={require("@/assets/images/icon.png")} style={styles.invoiceLogo} resizeMode="contain" />
                  <View style={{ flex: 1, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
                      {inv3 ? (isRTL ? "فاتورة الفني" : "Technician Invoice") : `${t("invoice.title")} #${displayNum}`}
                    </Text>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                      {isRTL ? "صافي المستحق" : "Net Payout"}: {displayTotal.toFixed(2)} {t("common.egp")}
                    </Text>
                  </View>
                  <VectorIcon name={invoiceExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
                {invoiceExpanded && (
                  <>
                    {inv3 ? (
                      <>
                        {(() => {
                          const matKey = `${item.id}-mat`;
                          const matExpanded = expandedInvoices[matKey] ?? false;
                          const hasMaterials = (item.materials ?? []).length > 0;
                          const materialsLabel = isRTL ? "تكلفة المواد" : "Materials Cost";
                          return (
                            <>
                              <TouchableOpacity
                                activeOpacity={hasMaterials ? 0.7 : 1}
                                onPress={() => {
                                  if (!hasMaterials) return;
                                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                  setExpandedInvoices((prev) => ({ ...prev, [matKey]: !matExpanded }));
                                }}
                                style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
                              >
                                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 4, flex: 1 }}>
                                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>{materialsLabel}</Text>
                                  {hasMaterials && (
                                    <VectorIcon name={matExpanded ? "chevron-up" : "chevron-down"} size={11} color={colors.mutedForeground} />
                                  )}
                                </View>
                                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                                  {inv3.materialsTotal.toFixed(2)} {t("common.egp")}
                                </Text>
                              </TouchableOpacity>
                              {matExpanded && (item.materials ?? []).map((mat) => (
                                <View key={mat.id} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row", paddingLeft: isRTL ? 0 : 16, paddingRight: isRTL ? 16 : 0, backgroundColor: colors.accent }]}>
                                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, flex: 1, textAlign: isRTL ? "right" : "left" }} numberOfLines={2}>
                                    {mat.description}
                                  </Text>
                                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
                                    {mat.amount.toFixed(2)} {t("common.egp")}
                                  </Text>
                                </View>
                              ))}
                            </>
                          );
                        })()}
                        {[
                          inv3.transportFee > 0 ? [isRTL ? "تكلفة النقل" : "Transport", inv3.transportFee] : null,
                          [isRTL ? "أجر العمالة" : "Labour Fee", inv3.labourFee],
                          [isRTL ? `خصم رسوم الخدمة (${SERVICE_FEE_RATE}%)` : `Service Fee (${SERVICE_FEE_RATE}%)`, -inv3.serviceFeeAmount],
                        ].filter(Boolean).map((row) => {
                          const [label, val] = row as [string, number];
                          return (
                            <View key={label} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>{label}</Text>
                              <Text style={{ color: val < 0 ? colors.destructive : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                                {val < 0 ? `−${Math.abs(val).toFixed(2)}` : val.toFixed(2)} {t("common.egp")}
                              </Text>
                            </View>
                          );
                        })}
                        <View style={[styles.invoiceTotalRow, { backgroundColor: colors.accent, borderRadius: colors.radius - 6, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{isRTL ? "صافي المستحق" : "Net Payout"}</Text>
                          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                            {inv3.techNetTotal.toFixed(2)} {t("common.egp")}
                          </Text>
                        </View>
                      </>
                    ) : invLegacy ? (
                      <>
                        {[
                          [t("invoice.materials"), invLegacy.materialsTotal],
                          [t("invoice.materialsMark"), invLegacy.materialsMark],
                          [t("invoice.labor"), invLegacy.laborFee],
                          [t("invoice.tools"), invLegacy.toolRental],
                          [t("invoice.tax"), invLegacy.tax],
                          [t("invoice.vat"), invLegacy.vat],
                        ].map(([label, val]) => (
                          <View key={label as string} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>{label as string}</Text>
                            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{(val as number).toFixed(2)} {t("common.egp")}</Text>
                          </View>
                        ))}
                        <View style={[styles.invoiceTotalRow, { backgroundColor: colors.accent, borderRadius: colors.radius - 6, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{t("invoice.total")}</Text>
                          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                            {invLegacy.total.toFixed(2)} {t("common.egp")}
                          </Text>
                        </View>
                      </>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.shareBtn, { backgroundColor: colors.darkMid, borderRadius: colors.radius - 4, flexDirection: isRTL ? "row-reverse" : "row", marginTop: 10 }]}
                      onPress={() => handleShareInvoice(item)}
                      activeOpacity={0.8}
                    >
                      <VectorIcon name="share-2" size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                        {t("invoice.share")}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          })()}
          {item.status === "completed" && (item.photos ?? []).length > 0 && (() => {
            const phaseDef: { phase: string; icon: IconName; labelAr: string; labelEn: string; color: string }[] = [
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
    const completeOrder = orders.find((o) => o.id === selectedOrderId);
    const clientMobile = completeOrder?.clientMobile ?? null;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t("tech.complete")} showBack onBack={handleCancelComplete} />
        {clientMobile ? (
          <View style={[styles.contactStrip, { backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              style={[styles.contactBtn, { borderColor: colors.border }]}
              onPress={() => Linking.openURL(`tel:${clientMobile}`).catch(() => {})}
            >
              <VectorIcon name="phone" size={16} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>{isRTL ? "اتصل بالعميل" : "Call Client"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { borderColor: colors.border }]}
              onPress={() => Linking.openURL(`sms:${clientMobile}`).catch(() => {})}
            >
              <VectorIcon name="message-circle" size={16} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>{isRTL ? "راسل العميل" : "Message Client"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={[styles.completeContent, { paddingBottom: botPad + 24 }]} keyboardShouldPersistTaps="handled">

          {/* MANDATORY: Receipt Photos */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: receiptError ? colors.destructive : colors.border }]}>
            <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginBottom: 10, gap: 6 }]}>
              <VectorIcon name="file-text" size={16} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left", marginBottom: 0, flex: 1 }]}>
                {isRTL ? "فواتير المواد (مطلوب)" : "Material Receipts (Required)"}
              </Text>
              <View style={{ backgroundColor: colors.destructive + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ color: colors.destructive, fontFamily: "Inter_700Bold", fontSize: 10 }}>{isRTL ? "إلزامي" : "Required"}</Text>
              </View>
            </View>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left", marginBottom: 10 }}>
              {isRTL ? "ارفع صورة كل فاتورة مواد اشتريتها. سيتم استخراج البيانات تلقائياً." : "Upload a photo of each material receipt. Data will be extracted automatically."}
            </Text>

            {receiptPhotos.length > 0 && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {receiptPhotos.map((r, i) => (
                    <View key={i} style={{ marginRight: 10, alignItems: "center" }}>
                      <Image source={{ uri: r.photoUrl }} style={{ width: 72, height: 72, borderRadius: 8, borderWidth: 2, borderColor: colors.success }} />
                      {r.detectedTotal > 0 && (
                        <Text style={{ color: colors.success, fontFamily: "Inter_700Bold", fontSize: 11, marginTop: 4 }}>
                          {r.detectedTotal.toFixed(0)} {t("common.egp")}
                        </Text>
                      )}
                      {r.supplier && (
                        <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular", maxWidth: 72 }} numberOfLines={1}>
                          {r.supplier}
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          setReceiptPhotos((prev) => {
                            const updated = prev.filter((_, j) => j !== i);
                            const newTotal = updated.reduce((sum, r2) => sum + r2.detectedTotal, 0);
                            if (newTotal > 0) setMaterialsTotalStr(newTotal.toFixed(2));
                            return updated;
                          });
                        }}
                        style={{ marginTop: 4 }}
                      >
                        <VectorIcon name="trash-2" size={13} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                {receiptPhotos.some((r) => r.lineItems.length > 0) && (
                  <View style={{ marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: "hidden" }}>
                    <View style={{ backgroundColor: colors.accent, padding: 8, flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 6 }}>
                      <VectorIcon name="list" size={13} color={colors.primary} />
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: colors.primary }}>
                        {isRTL ? "البنود المستخرجة من الفواتير" : "Extracted Receipt Line Items"}
                      </Text>
                    </View>
                    {receiptPhotos.map((r, ri) =>
                      r.lineItems.length > 0 ? (
                        <View key={ri} style={{ paddingHorizontal: 10, paddingBottom: 6 }}>
                          {r.supplier && (
                            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.mutedForeground, marginTop: 6, marginBottom: 4, textAlign: isRTL ? "right" : "left" }}>
                              {isRTL ? `فاتورة ${ri + 1}: ${r.supplier}` : `Receipt ${ri + 1}: ${r.supplier}`}
                            </Text>
                          )}
                          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 2, marginBottom: 2 }}>
                            <Text style={{ flex: 3, fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }}>
                              {isRTL ? "البيان" : "Description"}
                            </Text>
                            <Text style={{ flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.mutedForeground, textAlign: "center" }}>
                              {isRTL ? "الكمية" : "Qty"}
                            </Text>
                            <Text style={{ flex: 1.5, fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.mutedForeground, textAlign: isRTL ? "left" : "right" }}>
                              {isRTL ? "السعر" : "Price"}
                            </Text>
                          </View>
                          {r.lineItems.map((li, lii) => (
                            <View key={lii} style={{ flexDirection: isRTL ? "row-reverse" : "row", paddingVertical: 2 }}>
                              <Text style={{ flex: 3, fontFamily: "Inter_400Regular", fontSize: 11, color: colors.foreground, textAlign: isRTL ? "right" : "left" }} numberOfLines={2}>
                                {li.description}
                              </Text>
                              <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 11, color: colors.foreground, textAlign: "center" }}>
                                {li.qty}{li.unit ? ` ${li.unit}` : ""}
                              </Text>
                              <Text style={{ flex: 1.5, fontFamily: "Inter_500Medium", fontSize: 11, color: colors.foreground, textAlign: isRTL ? "left" : "right" }}>
                                {li.totalPrice.toFixed(0)}
                              </Text>
                            </View>
                          ))}
                          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.primary, textAlign: isRTL ? "right" : "left" }}>
                              {isRTL ? "المجموع" : "Subtotal"}
                            </Text>
                            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: colors.primary }}>
                              {r.detectedTotal.toFixed(0)} {t("common.egp")}
                            </Text>
                          </View>
                        </View>
                      ) : null
                    )}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              onPress={pickReceiptPhoto}
              disabled={receiptUploading || ocrRunning}
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                justifyContent: "center",
                padding: 14,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: receiptError ? colors.destructive : (receiptPhotos.length > 0 ? colors.success : colors.primary),
                borderRadius: 10,
                backgroundColor: colors.accent,
              }}
            >
              {receiptUploading || ocrRunning ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: 8 }}>
                    {ocrRunning ? (isRTL ? "جارٍ استخراج البيانات..." : "Extracting data...") : (isRTL ? "جارٍ الرفع..." : "Uploading...")}
                  </Text>
                </>
              ) : (
                <>
                  <VectorIcon name="camera" size={18} color={receiptPhotos.length > 0 ? colors.success : colors.primary} />
                  <Text style={{ color: receiptPhotos.length > 0 ? colors.success : colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 8 }}>
                    {receiptPhotos.length > 0
                      ? (isRTL ? `أضف فاتورة أخرى (${receiptPhotos.length} مرفق)` : `Add Another Receipt (${receiptPhotos.length} uploaded)`)
                      : (isRTL ? "ارفع صورة فاتورة المواد" : "Upload Receipt Photo")}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {receiptError && (
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginTop: 8, gap: 4 }}>
                <VectorIcon name="alert-circle" size={13} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{receiptError}</Text>
              </View>
            )}
          </View>

          {/* Fees Section */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginBottom: 14, gap: 6 }]}>
              <VectorIcon name="dollar-sign" size={16} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left", marginBottom: 0 }]}>
                {isRTL ? "تفاصيل الأتعاب" : "Fee Details"}
              </Text>
            </View>

            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left", marginBottom: 4 }}>
              {isRTL ? "إجمالي تكلفة المواد (ج.م)" : "Materials Total (EGP)"}
            </Text>
            <TextInput
              style={[styles.feeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={materialsTotalStr}
              onChangeText={setMaterialsTotalStr}
            />
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left", marginBottom: 12, marginTop: 2 }}>
              {receiptPhotos.length > 0
                ? (isRTL ? "مسبق التعبئة من الفواتير المرفوعة — يمكن تعديله" : "Pre-filled from uploaded receipts — you can edit")
                : (isRTL ? "أو أدخل الإجمالي يدوياً" : "Or enter total manually")}
            </Text>

            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left", marginBottom: 4 }}>
              {isRTL ? "أجر العمالة والمصنعية (ج.م) *" : "Labour & Service Fee (EGP) *"}
            </Text>
            <TextInput
              style={[styles.feeInput, { backgroundColor: colors.background, borderColor: labourFeeStr && labourFee > 0 ? colors.primary : colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
              placeholder={isRTL ? "مطلوب" : "Required"}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={labourFeeStr}
              onChangeText={setLabourFeeStr}
            />

            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left", marginBottom: 4, marginTop: 12 }}>
              {isRTL ? "تكلفة النقل (ج.م) — اختياري" : "Transport Cost (EGP) — Optional"}
            </Text>
            <TextInput
              style={[styles.feeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={transportFeeStr}
              onChangeText={setTransportFeeStr}
            />
          </View>

          {/* Preview Panel */}
          {labourFee > 0 && (
            <View style={[styles.section, { backgroundColor: colors.darkMid, borderRadius: colors.radius, borderColor: colors.border }]}>
              <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginBottom: 14, gap: 6 }]}>
                <VectorIcon name="eye" size={16} color={colors.primary} />
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
                  {isRTL ? "ملخص الفاتورة" : "Invoice Preview"}
                </Text>
              </View>

              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, textAlign: isRTL ? "right" : "left", marginBottom: 8 }}>
                  {isRTL ? "ما يدفعه العميل" : "Client Pays"}
                </Text>
                {[
                  [isRTL ? "تكلفة المواد" : "Materials", materialsTotal],
                  transportFee > 0 ? [isRTL ? "النقل" : "Transport", transportFee] : null,
                  [isRTL ? "أجر العمالة" : "Labour", labourFee],
                  [isRTL ? `رسوم الخدمة (${SERVICE_FEE_RATE}%)` : `Service Fee (${SERVICE_FEE_RATE}%)`, preview.serviceFeeAmount],
                  [isRTL ? `ضريبة القيمة المضافة (${VAT_RATE}%)` : `VAT (${VAT_RATE}%)`, preview.vatAmount],
                ].filter(Boolean).map((row) => {
                  const [label, val] = row as [string, number];
                  return (
                    <View key={label} style={[{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", paddingVertical: 4 }]}>
                      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{label}</Text>
                      <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" }}>{val.toFixed(2)} {t("common.egp")}</Text>
                    </View>
                  );
                })}
                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                  <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{isRTL ? "إجمالي العميل" : "Client Total"}</Text>
                  <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold", fontSize: 16 }}>{preview.clientTotal.toFixed(2)} {t("common.egp")}</Text>
                </View>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 14 }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, textAlign: isRTL ? "right" : "left", marginBottom: 8 }}>
                  {isRTL ? "صافي استحقاقك" : "Your Net Payout"}
                </Text>
                {[
                  [isRTL ? "تكلفة المواد" : "Materials", materialsTotal],
                  transportFee > 0 ? [isRTL ? "النقل" : "Transport", transportFee] : null,
                  [isRTL ? "أجر العمالة" : "Labour", labourFee],
                  [isRTL ? `خصم رسوم الخدمة (${SERVICE_FEE_RATE}%)` : `Service Fee Deduction (${SERVICE_FEE_RATE}%)`, -preview.serviceFeeAmount],
                ].filter(Boolean).map((row) => {
                  const [label, val] = row as [string, number];
                  return (
                    <View key={label} style={[{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", paddingVertical: 4 }]}>
                      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{label}</Text>
                      <Text style={{ color: val < 0 ? "#fca5a5" : "#fff", fontSize: 12, fontFamily: "Inter_500Medium" }}>
                        {val < 0 ? `−${Math.abs(val).toFixed(2)}` : val.toFixed(2)} {t("common.egp")}
                      </Text>
                    </View>
                  );
                })}
                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{isRTL ? "صافي استحقاقك" : "Your Net Payout"}</Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>{preview.techNetTotal.toFixed(2)} {t("common.egp")}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Solution Description */}
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>{t("tech.solutionDesc")}</Text>
            <FanniInput value={solutionDesc} onChangeText={setSolutionDesc} multiline numberOfLines={4} placeholder={isRTL ? "اشرح الحل الذي تم..." : "Describe the solution applied..."} />
          </View>

          {/* Client Satisfaction */}
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

          {/* After Photos */}
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
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent, borderRadius: 40 }]}>
              <VectorIcon name="briefcase" size={40} color={colors.primary} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 16, textAlign: "center" }}>
              {t("tech.noJobsYet")}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 6, textAlign: "center", paddingHorizontal: 32 }}>
              {t("tech.noJobsHint")}
            </Text>
            <TouchableOpacity
              style={[styles.profileBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={() => router.push("/(tech)/profile?openServiceArea=1")}
              activeOpacity={0.85}
            >
              <VectorIcon name="user" size={16} color="#FFF" />
              <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15, marginLeft: 8 }}>
                {t("tech.completeProfile")}
              </Text>
            </TouchableOpacity>
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
  invoiceBlock: { marginTop: 10, borderWidth: 1, padding: 12 },
  invoiceLogoRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1 },
  invoiceLogo: { width: 32, height: 32, borderRadius: 6 },
  invoiceRow: { paddingVertical: 8, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between" },
  invoiceTotalRow: { padding: 10, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  profileBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 },
  completeContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  section: { padding: 16, borderWidth: 1.5 },
  sectionTitle: { fontSize: 16, marginBottom: 14 },
  satisfactionOption: { padding: 14, marginBottom: 10, borderWidth: 1.5, alignItems: "center" },
  phasePhotoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 9, marginTop: 8, borderWidth: 1.5, borderStyle: "dashed" },
  completedGallery: { marginTop: 8, padding: 10, borderWidth: 1, borderRadius: 8 },
  subThumb: { width: 44, height: 44, borderWidth: 1 },
  miniThumb: { width: 48, height: 48, borderRadius: 6, marginRight: 6 },
  afterThumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8 },
  lightboxOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  lightboxImage: { width: "100%", height: "80%" },
  lightboxClose: { position: "absolute", top: 48, right: 20, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 8 },
  contactStrip: { flexDirection: "row", borderBottomWidth: 1 },
  contactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 6, borderRightWidth: 0 },
  contactBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  feeInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 4 },
  updatedBadge: { backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#F59E0B", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  updatedBadgeText: { color: "#B45309", fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.3 },
});
