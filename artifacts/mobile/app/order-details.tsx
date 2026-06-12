import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  Image,
  Alert,
  Share,
  ImageSourcePropType,
} from "react-native";
import ImageLightbox from "@/components/ImageLightbox";
import { shareOrderInvoicePdf } from "@/utils/invoicePdf";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders, ThreePartyInvoice } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import StarRating from "@/components/StarRating";
import FanniButton from "@/components/FanniButton";
import FanniInput from "@/components/FanniInput";
import AppHeader from "@/components/AppHeader";
import SUB_IMAGE_MAP from "@/constants/subImageMap";
import { useLocationLabels } from "@/hooks/useLocationLabels";

export default function OrderDetailsScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user: appUser } = useApp();
  const { orders, updateOrder } = useOrders();
  const insets = useSafeAreaInsets();

  const order = orders.find((o) => o.id === orderId);

  const { sessionToken } = useAuth();
  const [completionStatus, setCompletionStatus] = useState<"solved" | "stillExists" | "worsened" | null>(null);
  const [clientRating, setClientRating] = useState(0);
  const [clientComment, setClientComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  type RawInvoice = { labourFee?: number; transportFee?: number; ocrMaterialsTotal?: number; serviceFeeRate?: number; serviceFeeAmount?: number; vatRate?: number; vatAmount?: number; netTotal?: number; total?: number; materialsPhotos?: string[]; invoiceType?: string };
  const [fetchedTechInvoice, setFetchedTechInvoice] = useState<RawInvoice | null>(null);
  const [fetchedClientInvoice, setFetchedClientInvoice] = useState<RawInvoice | null>(null);
  const [fetchedAdminLedger, setFetchedAdminLedger] = useState<RawInvoice | null>(null);

  useEffect(() => {
    if (!order || order.status !== "completed" || !sessionToken) return;
    const domain = process.env["EXPO_PUBLIC_DOMAIN"];
    if (!domain) return;
    const apiBase = `http://${domain}`;
    fetch(`${apiBase}/api/invoices/order/${order.id}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { technicianInvoice?: RawInvoice; clientInvoice?: RawInvoice; adminLedger?: RawInvoice; invoices?: RawInvoice[] } | null) => {
        if (!data) return;
        if (data.technicianInvoice) setFetchedTechInvoice(data.technicianInvoice);
        if (data.clientInvoice) setFetchedClientInvoice(data.clientInvoice);
        if (data.adminLedger) setFetchedAdminLedger(data.adminLedger);
        if (!data.clientInvoice && !data.technicianInvoice && data.invoices?.length) {
          const ti = data.invoices.find((i) => i.invoiceType === "technician");
          const ci = data.invoices.find((i) => i.invoiceType === "client");
          const al = data.invoices.find((i) => i.invoiceType === "admin");
          if (ti) setFetchedTechInvoice(ti);
          if (ci) setFetchedClientInvoice(ci);
          if (al) setFetchedAdminLedger(al);
        }
      })
      .catch(() => {});
  }, [order?.id, order?.status, sessionToken]);

  function rawToThreeParty(ci: RawInvoice, ti?: RawInvoice | null, al?: RawInvoice | null): ThreePartyInvoice {
    const labour = Number(ci.labourFee ?? 0);
    const transport = Number(ci.transportFee ?? 0);
    const matTotal = Number(ci.ocrMaterialsTotal ?? 0);
    const serviceFeeRate = Number(ci.serviceFeeRate ?? 15);
    const serviceFeeAmount = Number(ci.serviceFeeAmount ?? 0);
    const vatRate = Number(ci.vatRate ?? 14);
    const vatAmount = Number(ci.vatAmount ?? 0);
    const clientTotal = Number(ci.netTotal ?? ci.total ?? 0);
    const techNetTotal = ti ? Number(ti.netTotal ?? ti.total ?? 0) : 0;
    const adminTotal = al ? Number(al.netTotal ?? al.total ?? 0) : serviceFeeAmount * 2 + vatAmount;
    return {
      labourFee: labour, transportFee: transport, materialsTotal: matTotal,
      serviceFeeRate, serviceFeeAmount, vatRate, vatAmount,
      techNetTotal, clientTotal, adminTotal,
      receiptPhotos: ci.materialsPhotos ?? [], ocrLineItems: [], generatedAt: new Date().toISOString(),
    };
  }

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>{t("common.noData")}</Text>
      </View>
    );
  }

  const handleConfirmCompletion = async () => {
    if (!completionStatus) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    await updateOrder(order.id, { completionStatus, status: completionStatus === "solved" ? "completed" : "inProgress" });
    setLoading(false);
  };

  const handleSubmitRating = async () => {
    if (clientRating === 0) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    await updateOrder(order.id, { clientRating, clientComment });
    setLoading(false);
    router.back();
  };

  const handleShareInvoice = async () => {
    await shareOrderInvoicePdf({
      order,
      threePartyInvoice: effectiveThreePartyInvoice,
      isTechnician,
      isRTL,
      t,
    });
  };

  const { slugToName } = useLocationLabels();

  const isAdmin = appUser?.role === "admin";
  const isTechnician = appUser?.role === "technician";

  const handleShareTracking = useCallback(async () => {
    const deepLink = `mobile://order-tracking?orderId=${orderId}`;
    const message = t("order.shareTrackingMsg");
    if (Platform.OS === "web") {
      const url = typeof window !== "undefined" ? window.location.href : deepLink;
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: t("order.shareTracking"), text: message, url });
          return;
        } catch {}
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url);
          Alert.alert(t("order.shareTrackingCopied"), url);
          return;
        } catch {}
      }
      Alert.alert(t("order.shareTracking"), url);
    } else {
      try {
        await Share.share({ message: `${message}\n${deepLink}`, url: deepLink, title: t("order.shareTracking") });
      } catch {}
    }
  }, [orderId, t]);

  const effectiveClientInvoice = fetchedClientInvoice ?? (order.threePartyInvoice ? { ...order.threePartyInvoice, netTotal: order.threePartyInvoice.clientTotal, total: order.threePartyInvoice.clientTotal } as { labourFee: number; transportFee: number; ocrMaterialsTotal: number; serviceFeeRate: number; serviceFeeAmount: number; vatRate: number; vatAmount: number; netTotal: number; total: number; materialsPhotos: string[] } : null);
  const effectiveTechInvoice = fetchedTechInvoice ?? (order.threePartyInvoice ? { ...order.threePartyInvoice, netTotal: order.threePartyInvoice.techNetTotal, total: order.threePartyInvoice.techNetTotal } as { labourFee: number; transportFee: number; ocrMaterialsTotal: number; serviceFeeRate: number; serviceFeeAmount: number; vatRate: number; vatAmount: number; netTotal: number; total: number; materialsPhotos: string[] } : null);

  function buildTechInvoice(ti: RawInvoice): ThreePartyInvoice {
    const labour = Number(ti.labourFee ?? 0);
    const transport = Number(ti.transportFee ?? 0);
    const matTotal = Number(ti.ocrMaterialsTotal ?? 0);
    const serviceFeeRate = Number(ti.serviceFeeRate ?? 15);
    const serviceFeeAmount = Number(ti.serviceFeeAmount ?? 0);
    const vatRate = Number(ti.vatRate ?? 14);
    const vatAmount = Number(ti.vatAmount ?? 0);
    const techNetTotal = Number(ti.netTotal ?? ti.total ?? 0);
    return {
      labourFee: labour, transportFee: transport, materialsTotal: matTotal,
      serviceFeeRate, serviceFeeAmount, vatRate, vatAmount,
      techNetTotal,
      clientTotal: 0,
      adminTotal: 0,
      receiptPhotos: ti.materialsPhotos ?? [], ocrLineItems: [], generatedAt: new Date().toISOString(),
    };
  }

  const effectiveThreePartyInvoice = isAdmin
    ? (effectiveClientInvoice ? rawToThreeParty(effectiveClientInvoice, effectiveTechInvoice, fetchedAdminLedger) : (order.threePartyInvoice ?? null))
    : isTechnician
      ? (effectiveTechInvoice ? buildTechInvoice(effectiveTechInvoice) : (order.threePartyInvoice ?? null))
      : (effectiveClientInvoice ? rawToThreeParty(effectiveClientInvoice, effectiveTechInvoice, fetchedAdminLedger) : (order.threePartyInvoice ?? null));

  const hasInvoice = !!order.invoice || !!effectiveThreePartyInvoice || !!fetchedClientInvoice || !!fetchedTechInvoice;
  const isCompleted = order.status === "completed";

  const phaseLabels: Record<string, string> = {
    problem: t("photo.phase.problem"),
    before: t("photo.phase.before"),
    during: t("photo.phase.during"),
    after: t("photo.phase.after"),
  };

  const photosByPhase = (["problem", "before", "during", "after"] as const).map((phase) => ({
    phase,
    photos: (order.photos ?? []).filter((p) => (p.phase ?? "problem") === phase),
  })).filter((g) => g.photos.length > 0);

  const allOrderedPhotos = photosByPhase.flatMap((g) => g.photos);
  const lightboxSources: ImageSourcePropType[] = allOrderedPhotos.map((p) => ({ uri: p.uri }));

  const openLightbox = (photoId: string) => {
    const idx = allOrderedPhotos.findIndex((p) => p.id === photoId);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setLightboxVisible(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Lightbox */}
      <ImageLightbox
        visible={lightboxVisible}
        sources={lightboxSources}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxVisible(false)}
      />

      <AppHeader
        title={order.orderNumber}
        showBack
        onBack={() => router.back()}
        rightElement={
          !isAdmin && !isTechnician && (order.status === "accepted" || order.status === "inProgress") ? (
            <TouchableOpacity
              onPress={handleShareTracking}
              style={styles.shareBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t("order.shareTracking")}
            >
              <VectorIcon name="share-2" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
      >
        {/* Status */}
        <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
          <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {order.subImageKey && SUB_IMAGE_MAP[order.subImageKey] && (
              <Image
                source={SUB_IMAGE_MAP[order.subImageKey]}
                style={[styles.subThumb, { borderRadius: colors.radius - 4, borderColor: colors.border }]}
                resizeMode="cover"
              />
            )}
            <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left" }]}>
              {t("order.tracking")}
            </Text>
            <StatusBadge status={order.status} />
          </View>
          <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <VectorIcon name="tag" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{t(`cat.${order.category}`)} — {order.subCategory}</Text>
          </View>
          <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <VectorIcon name="calendar" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{order.visitDate} {order.visitTime}</Text>
          </View>
        </View>

        {/* Problem */}
        <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
            {t("order.describe")}
          </Text>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22, textAlign: isRTL ? "right" : "left" }}>
            {order.problemDescription}
          </Text>
          {order.deviceType && (
            <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row", marginTop: 8 }]}>
              <VectorIcon name="cpu" size={14} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{order.deviceType}</Text>
            </View>
          )}
        </View>

        {/* Photo Gallery — collapsible per phase */}
        {photosByPhase.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("photo.gallery")}
            </Text>
            {photosByPhase.map(({ phase, photos: phasePhotos }, idx) => {
              const isCollapsed = collapsedPhases[phase] ?? false;
              const isLast = idx === photosByPhase.length - 1;
              return (
                <View key={phase} style={{ marginBottom: isLast ? 0 : 12 }}>
                  {/* Collapsible header */}
                  <TouchableOpacity
                    style={[styles.phaseHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border, borderBottomWidth: isCollapsed ? 0 : 1 }]}
                    onPress={() => setCollapsedPhases((prev) => ({ ...prev, [phase]: !prev[phase] }))}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.phaseLabelRow, { flexDirection: isRTL ? "row-reverse" : "row", flex: 1 }]}>
                      <VectorIcon
                        name={phase === "problem" ? "alert-circle" : phase === "before" ? "eye" : phase === "during" ? "tool" : "check-circle"}
                        size={13}
                        color={colors.primary}
                      />
                      <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: isRTL ? 0 : 5, marginRight: isRTL ? 5 : 0 }}>
                        {phaseLabels[phase]}
                      </Text>
                      <View style={[styles.photoCountBadge, { backgroundColor: colors.accent }]}>
                        <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 11 }}>{phasePhotos.length}</Text>
                      </View>
                    </View>
                    <VectorIcon name={isCollapsed ? "chevron-down" : "chevron-up"} size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {/* Expanded thumbnail row */}
                  {!isCollapsed && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginBottom: 4 }}>
                      {phasePhotos.map((photo) => (
                        <TouchableOpacity key={photo.id} onPress={() => openLightbox(photo.id)} activeOpacity={0.85}>
                          <Image source={{ uri: photo.uri }} style={styles.galleryThumb} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Location */}
        <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
            {t("order.schedule")}
          </Text>
          {[
            [isRTL ? "المحافظة" : "Governorate", order.governorate ? slugToName(order.governorate, isRTL ? "ar" : "en") : null],
            [isRTL ? "المنطقة" : "Area", order.area ? slugToName(order.area, isRTL ? "ar" : "en") : null],
            [t("order.street"), order.street],
            [t("order.building"), order.building],
            [t("order.floor"), order.floor],
            [t("order.apt"), order.apartment],
          ].filter(([, v]) => v).map(([label, value]) => (
            <View key={label as string} style={[styles.detailRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>{label as string}</Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{value as string}</Text>
            </View>
          ))}
        </View>

        {/* Technician info */}
        {order.technicianName && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("order.techInfo")}
            </Text>
            <View style={[styles.techCard, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {order.technicianAvatar ? (
                <Image source={{ uri: order.technicianAvatar }} style={styles.techAvatar} />
              ) : (
                <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 22 }}>{order.technicianName[0]}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: isRTL ? 0 : 14, marginRight: isRTL ? 14 : 0 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: isRTL ? "right" : "left" }}>
                  {order.technicianName}
                </Text>
                {order.technicianRating && (
                  <View style={[styles.ratingRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <VectorIcon name="star" size={14} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: 4 }}>
                      {order.technicianRating}
                    </Text>
                  </View>
                )}
                {order.technicianMobile && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${order.technicianMobile}`)}
                    activeOpacity={0.7}
                    style={[styles.phoneRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
                  >
                    <VectorIcon name="phone" size={13} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontFamily: "Inter_400Regular", fontSize: 13, marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }}>
                      {order.technicianMobile}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {order.technicianMobile && !isTechnician && !isAdmin && (
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.trackBtn, { flex: 1, backgroundColor: colors.primary, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
                  onPress={() => Linking.openURL(`tel:${order.technicianMobile}`)}
                  activeOpacity={0.85}
                >
                  <VectorIcon name="phone" size={16} color="#FFF" />
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                    {t("order.callTech")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.trackBtn, { flex: 1, backgroundColor: colors.secondary, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
                  onPress={() => Linking.openURL(`sms:${order.technicianMobile}`)}
                  activeOpacity={0.85}
                >
                  <VectorIcon name="message-circle" size={16} color="#FFF" />
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                    {t("order.smsTech")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.trackBtn, { flex: 1, backgroundColor: "#25D366", borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
                  onPress={() => {
                    const digits = (order.technicianMobile ?? "").replace(/\D/g, "");
                    Linking.openURL(`https://wa.me/${digits}`).catch(() => {});
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel={t("order.whatsappTech")}
                >
                  <VectorIcon name="message-square" size={16} color="#FFF" />
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                    {t("order.whatsappTech")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {(order.status === "accepted" || order.status === "inProgress") && (
              <TouchableOpacity
                style={[styles.trackBtn, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row", marginTop: 8 }]}
                onPress={() => router.push({ pathname: "/order-tracking", params: { orderId: order.id } })}
                activeOpacity={0.85}
              >
                <VectorIcon name="map-pin" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                  {t("order.trackBtn")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Completion status (if status = inProgress or accepted after tech completes) */}
        {order.status === "accepted" && !order.completionStatus && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("order.confirmCompletion")}
            </Text>
            {(["solved", "stillExists", "worsened"] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.completionOption,
                  {
                    borderColor: completionStatus === status ? colors.primary : colors.border,
                    backgroundColor: completionStatus === status ? colors.accent : colors.background,
                    borderRadius: colors.radius,
                    flexDirection: isRTL ? "row-reverse" : "row",
                  },
                ]}
                onPress={() => setCompletionStatus(status)}
              >
                <View style={[styles.radio, { borderColor: completionStatus === status ? colors.primary : colors.border, backgroundColor: completionStatus === status ? colors.primary : "transparent" }]} />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                  {t(`order.${status}`)}
                </Text>
              </TouchableOpacity>
            ))}
            <FanniButton
              title={t("common.confirm")}
              onPress={handleConfirmCompletion}
              loading={loading}
              disabled={!completionStatus}
              style={{ marginTop: 12 }}
              fullWidth
            />
          </View>
        )}

        {/* Invoice */}
        {hasInvoice && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            {/* Logo header */}
            <View style={[styles.invoiceLogoRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Image source={require("@/assets/images/icon.png")} style={styles.invoiceLogo} resizeMode="contain" />
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "فني · FANNI" : "FANNI · فني"}
              </Text>
              {order.invoice && (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>#{order.invoice.invoiceNumber}</Text>
              )}
            </View>
            {/* Technician info row */}
            {(order.technicianName || order.technicianMobile) && (
              <View style={[styles.invoiceTechRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
                <VectorIcon name="user" size={14} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0, flex: 1, textAlign: isRTL ? "right" : "left" }}>
                  {order.technicianName}
                </Text>
                {order.technicianMobile && (
                  <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center" }]}>
                    <VectorIcon name="phone" size={13} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }}>
                      {order.technicianMobile}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {isAdmin && effectiveThreePartyInvoice ? (
              <>
                {/* Admin: Technician Payout block */}
                {effectiveTechInvoice && (
                  <>
                    <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ backgroundColor: colors.primary + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 11 }}>{isRTL ? "الفني" : "Technician"}</Text>
                      </View>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{isRTL ? "دفعة الفني" : "Technician Payout"}</Text>
                    </View>
                    {[
                      [isRTL ? "تكلفة المواد" : "Materials Cost", Number(effectiveTechInvoice.ocrMaterialsTotal ?? 0)],
                      Number(effectiveTechInvoice.transportFee ?? 0) > 0 ? [isRTL ? "تكلفة النقل" : "Transport", Number(effectiveTechInvoice.transportFee)] : null,
                      [isRTL ? "أجر العمالة" : "Labour Fee", Number(effectiveTechInvoice.labourFee ?? 0)],
                      [isRTL ? `خصم رسوم الخدمة (${15}%)` : `Service Fee Deduction (${15}%)`, -Number(effectiveTechInvoice.serviceFeeAmount ?? 0)],
                    ].filter(Boolean).map(([label, val]) => (
                      <View key={label as string} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>{label as string}</Text>
                        <Text style={{ color: (val as number) < 0 ? colors.destructive : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                          {(val as number) < 0 ? `−${Math.abs(val as number).toFixed(2)}` : (val as number).toFixed(2)} {t("common.egp")}
                        </Text>
                      </View>
                    ))}
                    <View style={[{ padding: 10, borderRadius: 8, backgroundColor: colors.accent, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }]}>
                      <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{isRTL ? "صافي استحقاق الفني" : "Technician Net"}</Text>
                      <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{effectiveThreePartyInvoice.techNetTotal.toFixed(2)} {t("common.egp")}</Text>
                    </View>
                  </>
                )}

                {/* Admin: Client Invoice block */}
                <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ backgroundColor: colors.success + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: colors.success, fontFamily: "Inter_700Bold", fontSize: 11 }}>{isRTL ? "العميل" : "Client"}</Text>
                  </View>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{isRTL ? "فاتورة العميل" : "Client Invoice"}</Text>
                </View>
                {[
                  [isRTL ? "تكلفة المواد" : "Materials Cost", effectiveThreePartyInvoice.materialsTotal],
                  effectiveThreePartyInvoice.transportFee > 0 ? [isRTL ? "تكلفة النقل" : "Transport", effectiveThreePartyInvoice.transportFee] : null,
                  [isRTL ? "أجر العمالة" : "Labour Fee", effectiveThreePartyInvoice.labourFee],
                  [isRTL ? `رسوم الخدمة (${15}%)` : `Service Fee (${15}%)`, effectiveThreePartyInvoice.serviceFeeAmount],
                  [isRTL ? `ضريبة القيمة المضافة (${14}%)` : `VAT (${14}%)`, effectiveThreePartyInvoice.vatAmount],
                ].filter(Boolean).map(([label, val]) => (
                  <View key={label as string} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>{label as string}</Text>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{(val as number).toFixed(2)} {t("common.egp")}</Text>
                  </View>
                ))}
                <View style={[{ padding: 10, borderRadius: 8, backgroundColor: colors.accent, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }]}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{isRTL ? "إجمالي العميل" : "Client Total"}</Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{effectiveThreePartyInvoice.clientTotal.toFixed(2)} {t("common.egp")}</Text>
                </View>

                {/* Admin: Ledger block */}
                {(fetchedAdminLedger || effectiveThreePartyInvoice.adminTotal > 0) && (
                  <>
                    <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ backgroundColor: colors.secondary + "30", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold", fontSize: 11 }}>{isRTL ? "المنصة" : "Platform"}</Text>
                      </View>
                      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{isRTL ? "حساب المنصة" : "Platform Ledger"}</Text>
                    </View>
                    {[
                      [isRTL ? `رسوم الخدمة من الفني (${15}%)` : `Service Fee from Tech (${15}%)`, effectiveThreePartyInvoice.serviceFeeAmount],
                      [isRTL ? `رسوم الخدمة من العميل (${15}%)` : `Service Fee from Client (${15}%)`, effectiveThreePartyInvoice.serviceFeeAmount],
                      [isRTL ? `ضريبة القيمة المضافة (${14}%)` : `VAT Collected (${14}%)`, effectiveThreePartyInvoice.vatAmount],
                    ].map(([label, val]) => (
                      <View key={label as string} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>{label as string}</Text>
                        <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{(val as number).toFixed(2)} {t("common.egp")}</Text>
                      </View>
                    ))}
                    <View style={[{ padding: 10, borderRadius: 8, backgroundColor: colors.accent, flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }]}>
                      <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{isRTL ? "إجمالي المنصة" : "Platform Total"}</Text>
                      <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{effectiveThreePartyInvoice.adminTotal.toFixed(2)} {t("common.egp")}</Text>
                    </View>
                  </>
                )}
              </>
            ) : !isAdmin && effectiveThreePartyInvoice ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                  {isTechnician ? (isRTL ? "دفعة الفني" : "Technician Payout") : (isRTL ? "فاتورة العميل" : "Client Invoice")}
                </Text>
                {[
                  [isRTL ? "تكلفة المواد" : "Materials Cost", effectiveThreePartyInvoice.materialsTotal],
                  effectiveThreePartyInvoice.transportFee > 0 ? [isRTL ? "تكلفة النقل" : "Transport", effectiveThreePartyInvoice.transportFee] : null,
                  [isRTL ? "أجر العمالة" : "Labour Fee", effectiveThreePartyInvoice.labourFee],
                  isTechnician
                    ? [isRTL ? `خصم رسوم الخدمة (${15}%)` : `Service Fee Deduction (${15}%)`, -effectiveThreePartyInvoice.serviceFeeAmount]
                    : [isRTL ? `رسوم الخدمة (${15}%)` : `Service Fee (${15}%)`, effectiveThreePartyInvoice.serviceFeeAmount],
                  isTechnician ? null : [isRTL ? `ضريبة القيمة المضافة (${14}%)` : `VAT (${14}%)`, effectiveThreePartyInvoice.vatAmount],
                ].filter(Boolean).map(([label, val]) => (
                  <View key={label as string} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>{label as string}</Text>
                    <Text style={{ color: (val as number) < 0 ? colors.destructive : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                      {(val as number) < 0 ? `−${Math.abs(val as number).toFixed(2)}` : (val as number).toFixed(2)} {t("common.egp")}
                    </Text>
                  </View>
                ))}
                <View style={[styles.invoiceTotalRow, { backgroundColor: colors.accent, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>{isRTL ? "الإجمالي" : "Total"}</Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>
                    {(isTechnician ? effectiveThreePartyInvoice.techNetTotal : effectiveThreePartyInvoice.clientTotal).toFixed(2)} {t("common.egp")}
                  </Text>
                </View>
              </>
            ) : order.invoice ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
                  {t("invoice.title")} #{order.invoice.invoiceNumber}
                </Text>
                {[
                  [t("invoice.materials"), order.invoice.materialsTotal],
                  [t("invoice.materialsMark"), order.invoice.materialsMark],
                  [t("invoice.labor"), order.invoice.laborFee],
                  [t("invoice.tools"), order.invoice.toolRental],
                  [t("invoice.tax"), order.invoice.tax],
                  [t("invoice.vat"), order.invoice.vat],
                ].map(([label, val]) => (
                  <View key={label as string} style={[styles.invoiceRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>{label as string}</Text>
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{val as number} {t("common.egp")}</Text>
                  </View>
                ))}
                <View style={[styles.invoiceTotalRow, { backgroundColor: colors.accent, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 16 }}>{t("invoice.total")}</Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 18 }}>
                    {order.invoice.total} {t("common.egp")}
                  </Text>
                </View>
              </>
            ) : null}

            <FanniButton title={t("invoice.share")} onPress={handleShareInvoice} style={{ marginTop: 16 }} fullWidth />
          </View>
        )}

        {/* Rating */}
        {isCompleted && !order.clientRating && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("order.rate")}
            </Text>
            <View style={{ alignItems: "center", marginVertical: 16 }}>
              <StarRating rating={clientRating} onRate={setClientRating} size={36} />
            </View>
            <FanniInput
              label={t("order.rateComment")}
              value={clientComment}
              onChangeText={setClientComment}
              multiline
              numberOfLines={3}
              placeholder={isRTL ? "اكتب ملاحظاتك..." : "Write your comments..."}
            />
            <FanniButton
              title={t("common.confirm")}
              onPress={handleSubmitRating}
              loading={loading}
              disabled={clientRating === 0}
              fullWidth
            />
          </View>
        )}

        {order.clientRating && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("order.rate")}
            </Text>
            <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
              <StarRating rating={order.clientRating} readonly size={28} />
              {order.clientComment && (
                <Text style={{ color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 10, lineHeight: 22 }}>
                  {order.clientComment}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  section: {
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 16 },
  row: { alignItems: "center", marginBottom: 10, gap: 8 },
  subThumb: { width: 44, height: 44, borderWidth: 1 },
  infoRow: { alignItems: "center", marginTop: 6, gap: 6 },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailRow: { paddingVertical: 10, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between" },
  techCard: { alignItems: "center", gap: 0 },
  techAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  ratingRow: { alignItems: "center", gap: 4, marginTop: 4 },
  phoneRow: { alignItems: "center", gap: 4, marginTop: 4 },
  completionOption: { padding: 14, marginBottom: 10, borderWidth: 1.5, alignItems: "center", gap: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  invoiceLogoRow: { alignItems: "center", marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1 },
  invoiceTechRow: { alignItems: "center", paddingVertical: 10, marginBottom: 14, borderBottomWidth: 1 },
  invoiceLogo: { width: 40, height: 40, borderRadius: 8 },
  invoiceRow: { paddingVertical: 10, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between" },
  invoiceTotalRow: { padding: 14, marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  trackBtn: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  phaseLabelRow: { alignItems: "center", gap: 4, marginBottom: 2 },
  phaseHeader: { paddingVertical: 10, alignItems: "center", justifyContent: "space-between", gap: 8 },
  photoCountBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginLeft: 6 },
  galleryThumb: { width: 88, height: 88, borderRadius: 8, marginRight: 8 },
  shareBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
});
