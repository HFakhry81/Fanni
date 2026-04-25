import React, { useState } from "react";
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
  Modal,
} from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { readAsStringAsync } from "expo-file-system/legacy";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders } from "@/context/OrderContext";
import StatusBadge from "@/components/StatusBadge";
import StarRating from "@/components/StarRating";
import FanniButton from "@/components/FanniButton";
import FanniInput from "@/components/FanniInput";
import AppHeader from "@/components/AppHeader";

export default function OrderDetailsScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { orders, updateOrder } = useOrders();
  const insets = useSafeAreaInsets();

  const order = orders.find((o) => o.id === orderId);

  const [completionStatus, setCompletionStatus] = useState<"solved" | "stillExists" | "worsened" | null>(null);
  const [clientRating, setClientRating] = useState(0);
  const [clientComment, setClientComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});

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
    if (!order.invoice) return;
    const inv = order.invoice;
    const dir = isRTL ? "rtl" : "ltr";

    let logoDataUri = "";
    try {
      const asset = Asset.fromModule(require("@/assets/images/icon.png"));
      await asset.downloadAsync();
      if (asset.localUri) {
        const base64 = await readAsStringAsync(asset.localUri, {
          encoding: "base64",
        });
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
  .meta{background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .meta-item{display:flex;flex-direction:column;gap:2px}
  .meta-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
  .meta-value{font-size:14px;font-weight:600;color:#111827}
</style>
</head>
<body>
<div class="header">
  ${logoImg}
  <div class="brand">${isRTL ? "فني · FANNI" : "FANNI · فني"}</div>
  <div class="invoice-num">#${inv.invoiceNumber}</div>
</div>
<h2>${t("invoice.title")} #${inv.invoiceNumber}</h2>
<div class="meta">
  <div class="meta-item">
    <span class="meta-label">${t("invoice.client")}</span>
    <span class="meta-value">${order.clientName}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">${t("invoice.orderNumber")}</span>
    <span class="meta-value">${order.orderNumber}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">${t("invoice.date")}</span>
    <span class="meta-value">${new Date(order.visitDate).toLocaleDateString(isRTL ? "ar-EG" : "en-GB", { year: "numeric", month: "long", day: "numeric" })}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">${t("invoice.category")}</span>
    <span class="meta-value">${t(`cat.${order.category}`) || order.category}</span>
  </div>
  ${order.technicianName ? `<div class="meta-item">
    <span class="meta-label">${t("invoice.technician")}</span>
    <span class="meta-value">${order.technicianName}</span>
  </div>` : ""}
  ${order.technicianMobile ? `<div class="meta-item">
    <span class="meta-label">${t("invoice.phone")}</span>
    <span class="meta-value" style="direction:ltr;unicode-bidi:plaintext">${order.technicianMobile}</span>
  </div>` : ""}
</div>
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

  const hasInvoice = !!order.invoice;
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
        title={order.orderNumber}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}
      >
        {/* Status */}
        <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
          <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
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
                        <TouchableOpacity key={photo.id} onPress={() => setLightboxUri(photo.uri)} activeOpacity={0.85}>
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
            [t("order.street"), order.street],
            [t("order.building"), order.building],
            [t("order.floor"), order.floor],
            [t("order.apt"), order.apartment],
          ].filter(([, v]) => v).map(([label, value]) => (
            <View key={label} style={[styles.detailRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>{label}</Text>
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{value}</Text>
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
            {order.technicianMobile && (
              <TouchableOpacity
                style={[styles.trackBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}
                onPress={() => Linking.openURL(`tel:${order.technicianMobile}`)}
                activeOpacity={0.85}
              >
                <VectorIcon name="phone" size={16} color="#FFF" />
                <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                  {t("order.callTech")}
                </Text>
              </TouchableOpacity>
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
        {hasInvoice && order.invoice && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            {/* Logo header */}
            <View style={[styles.invoiceLogoRow, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.invoiceLogo}
                resizeMode="contain"
              />
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "فني · FANNI" : "FANNI · فني"}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                #{order.invoice.invoiceNumber}
              </Text>
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
            <FanniButton
              title={t("invoice.share")}
              onPress={handleShareInvoice}
              style={{ marginTop: 16 }}
              fullWidth
            />
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
  lightboxOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  lightboxImage: { width: "100%", height: "80%" },
  lightboxClose: { position: "absolute", top: 48, right: 20, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 8 },
});
