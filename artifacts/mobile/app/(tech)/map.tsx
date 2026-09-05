import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform, Modal, Pressable, ActivityIndicator, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import VectorIcon from "@/components/VectorIcon";
import { useRouter, useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders, Order } from "@/context/OrderContext";
import { useWallet } from "@/context/WalletContext";
import FanniButton from "@/components/FanniButton";
import AppHeader from "@/components/AppHeader";
import { getApiBase } from "@/utils/api";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import OsmMapView from "@/components/OsmMapView";
import { shouldShowDailyPrompt, markDailyPromptShown } from "@/utils/dailyPrompt";

const ALEXANDRIA = { latitude: 31.2001, longitude: 29.9187 };
const LOCATION_BANNER_KEY = "fanni.tech.map.location_banner";
const DEFAULT_UNLOCK_COST = 20;

export default function TechMapScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user, isOnline, setIsOnline, hasPendingToggle } = useApp();
  const { sessionToken } = useAuth();
  const { summary, refreshWallet } = useWallet();
  const { allOrders, updateOrder, newPendingOrders, markOrderSeen } = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const autoShownRef = useRef<Set<string>>(new Set());
  const [catBannerDismissed, setCatBannerDismissed] = useState(false);
  const [catBannerHydrated, setCatBannerHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("catBannerDismissed")
      .then((val) => {
        if (val === "true") setCatBannerDismissed(true);
      })
      .catch(() => {})
      .finally(() => setCatBannerHydrated(true));
  }, []);

  const dismissCatBanner = () => {
    setCatBannerDismissed(true);
    AsyncStorage.setItem("catBannerDismissed", "true").catch(() => {});
  };
  const [serverPendingOrders, setServerPendingOrders] = useState<Order[] | null>(null);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);

  const hasProfession = !!user?.profession?.trim();
  const showCatBanner = catBannerHydrated && !!user && !catBannerDismissed && !hasProfession;

  const govLabel = (isRTL ? user?.governorateNameAr : user?.governorateNameEn) ?? user?.governorate ?? null;
  const areaLabel = (isRTL ? user?.areaNameAr : user?.areaNameEn) ?? user?.area ?? null;
  const hasServiceArea = !!(govLabel && areaLabel);
  const serviceAreaDisplay = [govLabel, areaLabel].filter(Boolean).join(" — ");

  const [locationBannerVisible, setLocationBannerVisible] = useState(false);

  const mapCenter = useMemo(() => {
    const extended = user as typeof user & { latitude?: number | null; longitude?: number | null };
    if (extended?.latitude != null && extended?.longitude != null) {
      return { latitude: extended.latitude, longitude: extended.longitude };
    }
    return ALEXANDRIA;
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!user || hasServiceArea) return;
        const show = await shouldShowDailyPrompt(`${LOCATION_BANNER_KEY}:${user.id}`);
        if (!cancelled && show) {
          setLocationBannerVisible(true);
          await markDailyPromptShown(`${LOCATION_BANNER_KEY}:${user.id}`);
        }
      })();
      return () => { cancelled = true; };
    }, [user, hasServiceArea]),
  );

  const fetchServerPendingOrders = useCallback(async () => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    setIsFetchingOrders(true);
    try {
      const res = await fetch(`${apiBase}/api/technician/pending-orders?limit=20`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setServerPendingOrders(json.orders ?? []);
      } else {
        console.warn(`[Fanni] Failed to fetch pending orders from server: ${res.status}`);
        setServerPendingOrders(null);
      }
    } catch (err) {
      console.warn("[Fanni] Network error fetching pending orders:", err);
      setServerPendingOrders(null);
    } finally {
      setIsFetchingOrders(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!isOnline) {
      setServerPendingOrders(null);
      return;
    }
    fetchServerPendingOrders();
    const intervalId = setInterval(() => {
      fetchServerPendingOrders();
    }, 30_000);
    return () => clearInterval(intervalId);
  }, [isOnline, sessionToken, user?.governorate, user?.area, user?.profession, fetchServerPendingOrders]);

  const localPendingOrders = allOrders.filter((o) => o.status === "pending");
  const localFilteredOrders = hasServiceArea
    ? localPendingOrders.filter((o) => {
        // Governorate gate only — area is preference on the server, not a client hard filter.
        if (o.governorate && user?.governorate && o.governorate !== user.governorate) {
          const og = o.governorate.toLowerCase();
          const ug = user.governorate.toLowerCase();
          if (og !== ug && !og.includes(ug) && !ug.includes(og)) return false;
        }
        return true;
      })
    : localPendingOrders;

  let pendingOrders: Order[];
  if (isOnline && serverPendingOrders !== null) {
    const serverIds = new Set(serverPendingOrders.map((o) => o.id));
    const realtimeOnly = newPendingOrders
      .filter((o) => !serverIds.has(o.id))
      .filter((o) => {
        if (hasServiceArea && o.governorate && user?.governorate) {
          const og = o.governorate.toLowerCase();
          const ug = user.governorate.toLowerCase();
          if (og !== ug && !og.includes(ug) && !ug.includes(og)) return false;
        }
        return true;
      });
    pendingOrders = [...realtimeOnly, ...serverPendingOrders];
  } else {
    pendingOrders = localFilteredOrders;
  }

  useEffect(() => {
    if (!isOnline && modalVisible) {
      setModalVisible(false);
      setSelectedOrder(null);
    }
  }, [isOnline, modalVisible]);

  useEffect(() => {
    if (!isOnline) return;
    if (newPendingOrders.length === 0) return;
    const areaFiltered = hasServiceArea
      ? newPendingOrders.filter((o) => {
          if (o.governorate && user?.governorate) {
            const og = o.governorate.toLowerCase();
            const ug = user.governorate.toLowerCase();
            if (og !== ug && !og.includes(ug) && !ug.includes(og)) return false;
          }
          return true;
        })
      : newPendingOrders;
    const areaFilteredIds = new Set(areaFiltered.map((o) => o.id));
    newPendingOrders.forEach((o) => {
      if (!areaFilteredIds.has(o.id)) {
        markOrderSeen(o.id);
      }
    });
    const unshown = areaFiltered.filter((o) => !autoShownRef.current.has(o.id));
    if (unshown.length === 0) return;
    if (modalVisible) return;
    const order = unshown[0];
    autoShownRef.current.add(order.id);
    setSelectedOrder(order);
    setModalVisible(true);
    fetchServerPendingOrders();
  }, [newPendingOrders, modalVisible, isOnline, hasServiceArea, user?.governorate, user?.area]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlockCostOf = (order: Order) =>
    (order as Order & { unlockCost?: number }).unlockCost ?? DEFAULT_UNLOCK_COST;

  const showInsufficientPoints = (required: number, balance: number) => {
    Alert.alert(
      isRTL ? "رصيدك الحالي مش كافي" : "Insufficient points",
      isRTL
        ? `محتاج ${required} نقطة، ورصيدك الحالي ${balance} نقاط.`
        : `You need ${required} points. Current balance: ${balance}.`,
      [
        { text: isRTL ? "العودة" : "Back", style: "cancel" },
        { text: isRTL ? "شحن الرصيد" : "Top up", onPress: () => router.push("/(tech)/wallet") },
      ],
    );
  };

  const handleAccept = async (orderArg?: Order | null) => {
    const order = orderArg ?? selectedOrder;
    if (!order) return;

    const cost = unlockCostOf(order);
    const latest = await refreshWallet();
    const balance = latest?.pointsBalance ?? summary?.pointsBalance ?? 0;
    if (balance < cost) {
      showInsufficientPoints(cost, balance);
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        isRTL ? "قبل ما نكمّل" : "Before we continue",
        isRTL
          ? `هيتم خصم ${cost} نقطة من رصيدك (المتاح ${balance}) لفتح بيانات العميل.`
          : `${cost} points will be deducted from your balance (${balance} available) to unlock client details.`,
        [
          { text: isRTL ? "لا، مش دلوقتي" : "Not now", style: "cancel", onPress: () => resolve(false) },
          { text: isRTL ? "موافق وكمل" : "Confirm", onPress: () => resolve(true) },
        ],
      );
    });
    if (!confirmed) return;

    setLoading(true);
    setSelectedOrder(order);
    const techUpdate = {
      status: "accepted" as const,
      technicianId: user?.id ?? "",
      technicianName: user?.name ?? "",
      technicianMobile: user?.mobile ?? "",
      technicianAvatar: resolveMediaUrl(user?.avatar, { token: sessionToken }),
      technicianRating: 4.8,
    };
    let serverSynced = false;
    try {
      // Fresh balance check right before charging.
      const rechecked = await refreshWallet();
      const liveBalance = rechecked?.pointsBalance ?? balance;
      if (liveBalance < cost) {
        showInsufficientPoints(cost, liveBalance);
        setLoading(false);
        return;
      }

      const apiBase = getApiBase();
      if (apiBase && sessionToken) {
        const res = await fetch(`${apiBase}/api/orders/${order.id}/accept`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            technicianName: techUpdate.technicianName,
            technicianMobile: techUpdate.technicianMobile,
            technicianAvatar: techUpdate.technicianAvatar,
            technicianRating: techUpdate.technicianRating,
          }),
        });
        const json = await res.json().catch(() => ({})) as {
          error?: string;
          required?: number;
          balance?: number;
        };
        if (res.ok) {
          serverSynced = true;
          await refreshWallet();
        } else if (res.status === 402) {
          showInsufficientPoints(json.required ?? cost, json.balance ?? liveBalance);
          await refreshWallet();
          setLoading(false);
          return;
        } else {
          console.warn(`[Fanni] Failed to accept order on server: ${res.status}`, json.error);
          Alert.alert(
            isRTL ? "تعذّر القبول" : "Accept failed",
            json.error ?? (isRTL ? "حاول مرة أخرى." : "Please try again."),
          );
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("[Fanni] Network error accepting order:", err);
      Alert.alert(
        isRTL ? "خطأ في الاتصال" : "Connection error",
        isRTL ? "تحقق من الإنترنت وحاول مرة أخرى." : "Check your connection and try again.",
      );
      setLoading(false);
      return;
    }
    if (serverSynced || !sessionToken) {
      await updateOrder(order.id, techUpdate);
    }
    setLoading(false);
    setModalVisible(false);
    markOrderSeen(order.id);
    setSelectedOrder(null);
    router.push("/(tech)/orders");
  };

  const handleReject = async (orderArg?: Order | null) => {
    const order = orderArg ?? selectedOrder;
    if (!order) return;
    // Dismiss popup/notification only — keep order on map & available lists.
    autoShownRef.current.add(order.id);
    markOrderSeen(order.id);
    const apiBase = getApiBase();
    if (apiBase && sessionToken) {
      try {
        await fetch(`${apiBase}/api/orders/${order.id}/decline`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
        });
      } catch {
        /* best-effort notification dismiss */
      }
    }
    setModalVisible(false);
    setSelectedOrder(null);
  };

  const handleOpenOrder = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={user?.name ?? t("app.name")}
        subtitle={isRTL ? "منطقة الخدمة" : "Service Area"}
        showLangToggle
        rightElement={
          <TouchableOpacity
            style={[
              styles.onlineBadge,
              { backgroundColor: hasPendingToggle ? "#F59E0B" : isOnline ? "#22A36B" : "#EF4444" },
            ]}
            onPress={() => setIsOnline(!isOnline, sessionToken ?? undefined)}
            activeOpacity={0.75}
          >
            {hasPendingToggle ? (
              <ActivityIndicator size={10} color="#FFF" style={{ marginEnd: 4 }} />
            ) : (
              <View style={styles.onlineDot} />
            )}
            <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
              {hasPendingToggle ? t("tech.syncing") : isOnline ? t("tech.online") : t("tech.offline")}
            </Text>
          </TouchableOpacity>
        }
      />

      {/* Live service-area map */}
      <View style={[styles.mapLive, { borderColor: colors.border }]}>
        <OsmMapView
          style={StyleSheet.absoluteFill}
          initialCoords={mapCenter}
          markerCoords={mapCenter}
          zoom={13}
          pinColor={colors.primary}
        />
        <View style={[styles.mapBadge, { backgroundColor: colors.primary }]}>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11 }}>
            {pendingOrders.length} {isRTL ? "طلبات" : "orders"}
          </Text>
        </View>
      </View>

      <Modal visible={locationBannerVisible} transparent animationType="fade" onRequestClose={() => setLocationBannerVisible(false)}>
        <View style={styles.locationModalOverlay}>
          <View style={[styles.locationModalCard, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "center", marginBottom: 8 }}>
              {isRTL ? "الرجاء تحديد مكانك" : "Set your location"}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", marginBottom: 16 }}>
              {isRTL
                ? "حدد منطقة خدمتك لتصبح متاحاً لاستقبال الطلبات في منطقتك."
                : "Set your service area so you can receive orders in your zone."}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 }}
              onPress={() => {
                setLocationBannerVisible(false);
                router.push("/(tech)/profile?openServiceArea=1");
              }}
            >
              <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", textAlign: "center" }}>
                {isRTL ? "تحديد المنطقة" : "Set service area"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLocationBannerVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>{isRTL ? "لاحقاً" : "Later"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Service Area Banner */}
      {hasServiceArea ? (
        <Pressable
          style={({ pressed }) => [styles.serviceAreaBanner, { backgroundColor: colors.card, borderColor: colors.primary + "30", flexDirection: isRTL ? "row-reverse" : "row", opacity: pressed ? 0.75 : 1 }]}
          onPress={() => router.push("/(tech)/profile")}
        >
          <View style={[styles.serviceAreaIcon, { backgroundColor: colors.primary + "15" }]}>
            <VectorIcon name="map-pin" size={14} color={colors.primary} />
          </View>
          <View style={[styles.serviceAreaText, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }}>
              {t("tech.serviceArea")}
            </Text>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, marginTop: 1 }}>
              {serviceAreaDisplay}
            </Text>
            <Text style={{ color: "#22A36B", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 }}>
              {t("tech.filteredByArea")}
            </Text>
          </View>
          <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={14} color={colors.primary} />
        </Pressable>
      ) : (
        <Pressable
          style={[styles.serviceAreaBanner, styles.serviceAreaWarning, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={() => router.push("/(tech)/profile")}
        >
          <View style={[styles.serviceAreaIcon, { backgroundColor: "#FEF3C7" }]}>
            <VectorIcon name="alert-circle" size={14} color="#D97706" />
          </View>
          <View style={[styles.serviceAreaText, { alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }]}>
            <Text style={{ color: "#92400E", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
              {t("tech.noServiceArea")}
            </Text>
            <Text style={{ color: "#B45309", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 }}>
              {t("tech.allOrdersShown")}
            </Text>
          </View>
          <VectorIcon name={isRTL ? "chevron-left" : "chevron-right"} size={14} color="#D97706" />
        </Pressable>
      )}

      {/* No-profession nudge banner */}
      {showCatBanner && (
        <Pressable
          style={[styles.catBanner, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA", flexDirection: isRTL ? "row-reverse" : "row" }]}
          onPress={() => router.push("/(tech)/profile")}
        >
          <View style={[styles.serviceAreaIcon, { backgroundColor: "#FFEDD5" }]}>
            <VectorIcon name="briefcase" size={14} color="#EA580C" />
          </View>
          <View style={[styles.serviceAreaText, { alignItems: isRTL ? "flex-end" : "flex-start", flex: 1 }]}>
            <Text style={{ color: "#7C2D12", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
              {t("tech.noProfession")}
            </Text>
            <Text style={{ color: "#C2410C", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 }}>
              {t("tech.noProfessionPrompt")}
            </Text>
          </View>
          <Pressable
            onPress={(e) => { e.stopPropagation(); dismissCatBanner(); }}
            style={{ padding: 4 }}
            hitSlop={8}
          >
            <VectorIcon name="x" size={14} color="#9A3412" />
          </Pressable>
        </Pressable>
      )}

      {/* Orders list */}
      <View style={[styles.ordersSection, { backgroundColor: colors.background }]}>
        {!isOnline && (
          <View style={[styles.offlineBanner, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <VectorIcon name="wifi-off" size={14} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 6 }}>
              {isRTL ? "أنت غير متاح — لن تتلقى طلبات جديدة" : "You are offline — no new orders will be received"}
            </Text>
          </View>
        )}
        <View style={[styles.listHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: isRTL ? "right" : "left" }}>
            {isRTL ? "الطلبات المتاحة" : "Available Orders"}
          </Text>
          <View style={[styles.countChip, { backgroundColor: colors.primary + "20" }]}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>{pendingOrders.length}</Text>
          </View>
        </View>
        <FlatList
          data={pendingOrders}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ListEmptyComponent={
            isFetchingOrders ? (
              <View style={styles.emptyHoriz}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 10, fontFamily: "Inter_400Regular" }}>
                  {isRTL ? "جارٍ تحميل الطلبات…" : "Loading orders…"}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyHoriz}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 30 }]}>
                  <VectorIcon name="inbox" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                  {t("common.noData")}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const isNew = newPendingOrders.some((o) => o.id === item.id);
            return (
              <TouchableOpacity
                style={[
                  styles.pendingCard,
                  {
                    backgroundColor: colors.card,
                    borderRadius: colors.radius,
                    borderColor: isNew ? "#EF4444" : colors.border,
                    borderWidth: isNew ? 2 : 1.5,
                  },
                ]}
                onPress={() => handleOpenOrder(item)}
                activeOpacity={0.85}
              >
                <View style={[styles.cardAccent, { backgroundColor: isNew ? "#EF4444" : colors.primary }]} />
                <View style={styles.cardContent}>
                  {isNew && (
                    <View style={[styles.newBadge, { backgroundColor: "#EF4444" }]}>
                      <Text style={{ color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" }}>
                        {isRTL ? "جديد" : "NEW"}
                      </Text>
                    </View>
                  )}
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 2, textAlign: isRTL ? "right" : "left" }}>
                    {item.orderNumber}
                  </Text>
                  <View style={[styles.catChip, { backgroundColor: colors.accent, borderRadius: 8 }]}>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                      {t(`cat.${item.category}`)}
                    </Text>
                  </View>
                  <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <VectorIcon name="map-pin" size={11} color={colors.secondary} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 3, flex: 1 }} numberOfLines={1}>
                      {item.street}
                    </Text>
                  </View>
                  <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <VectorIcon name="calendar" size={11} color={colors.secondary} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 3 }}>
                      {item.visitDate}
                    </Text>
                  </View>
                  <View style={[styles.orderBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <TouchableOpacity
                      style={[styles.acceptBtn, { backgroundColor: colors.primary, borderRadius: 8, flex: 1 }]}
                      onPress={() => { void handleAccept(item); }}
                    >
                      <VectorIcon name="check" size={12} color="#FFF" />
                      <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11, marginLeft: 4 }}>{t("tech.accept")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rejectBtn, { borderColor: colors.border, borderRadius: 8, flex: 1 }]}
                      onPress={() => { void handleReject(item); }}
                    >
                      <VectorIcon name="x" size={12} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 4 }}>{t("tech.reject")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderRadius: 24 }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.modalTitle, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.modalIcon, { backgroundColor: "#FEE2E2", borderRadius: 12 }]}>
                <VectorIcon name="bell" size={18} color="#EF4444" />
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
                {t("tech.newOrder")}
              </Text>
              {selectedOrder && newPendingOrders.some((o) => o.id === selectedOrder.id) && (
                <View style={[styles.liveTag, { backgroundColor: "#EF4444" }]}>
                  <View style={styles.liveDot} />
                  <Text style={{ color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" }}>
                    {isRTL ? "مباشر" : "LIVE"}
                  </Text>
                </View>
              )}
            </View>
            {selectedOrder && (
              <>
                <View style={[styles.modalOrderNum, { backgroundColor: colors.muted, borderRadius: 10 }]}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>{selectedOrder.orderNumber}</Text>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 2 }}>
                    {t(`cat.${selectedOrder.category}`)} — {selectedOrder.subCategory}
                  </Text>
                </View>
                {[
                  [t("order.problemDesc"),     selectedOrder.problemDescription],
                  [t("order.visitDate"),        `${selectedOrder.visitDate} ${selectedOrder.visitTime}`],
                  [isRTL ? "العنوان" : "Address", `${selectedOrder.street}, ${t("order.floor")} ${selectedOrder.floor}`],
                ].map(([label, value]) => (
                  <View key={label} style={[styles.modalRow, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>{label}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 2, textAlign: isRTL ? "left" : "right" }} numberOfLines={2}>{value}</Text>
                  </View>
                ))}
                <View style={[styles.modalBtns, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                  <FanniButton title={t("tech.reject")} onPress={() => { void handleReject(); }} variant="outline" style={{ flex: 1 }} />
                  <FanniButton title={t("tech.accept")} onPress={() => { void handleAccept(); }} loading={loading} style={{ flex: 1 }} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  onlineBadge: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFF" },
  mapLive: { height: 210, marginHorizontal: 16, marginTop: 8, borderRadius: 12, overflow: "hidden", borderWidth: 1, position: "relative" },
  locationModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  locationModalCard: { width: "100%", maxWidth: 340, borderRadius: 14, padding: 20 },
  mapGrid: { ...StyleSheet.absoluteFillObject, flexDirection: "row", flexWrap: "wrap" },
  mapCell: { width: "20%", height: "25%", borderWidth: 0.5 },
  seaBand: { position: "absolute", top: 0, left: 0, right: 0, height: 38, alignItems: "center", justifyContent: "center" },
  cityLabel: { position: "absolute", top: 45, left: "38%", alignItems: "center" },
  cityDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 3 },
  districtTag: { position: "absolute", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  mapPin: { position: "absolute", width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  pinBadge: { position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  pinPulse: { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "#EF4444", opacity: 0.5 },
  myLocation: { position: "absolute", bottom: 20, right: 20, width: 18, height: 18, borderRadius: 9, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  myLocationInner: { width: 7, height: 7, borderRadius: 4 },
  mapBadge: { position: "absolute", bottom: 10, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  ordersSection: { flex: 1 },
  offlineBanner: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
  listHeader: { paddingHorizontal: 16, paddingTop: 14, marginBottom: 10, alignItems: "center", gap: 8 },
  countChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12 },
  horizontalList: { paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 100 : 90, gap: 10 },
  pendingCard: { width: 210, flexDirection: "row", overflow: "hidden" },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: 12 },
  catChip: { alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 8, marginBottom: 8 },
  infoRow: { alignItems: "center", marginBottom: 5 },
  orderBtns: { gap: 6, marginTop: 8 },
  acceptBtn: { paddingVertical: 7, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  rejectBtn: { paddingVertical: 7, alignItems: "center", borderWidth: 1.5, backgroundColor: "transparent", flexDirection: "row", justifyContent: "center" },
  emptyHoriz: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingVertical: 20 },
  emptyIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  newBadge: { alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, marginBottom: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalContent: { padding: 24, margin: 12, marginBottom: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { alignItems: "center", marginBottom: 16, gap: 8 },
  modalIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  modalOrderNum: { padding: 14, marginBottom: 12 },
  modalRow: { paddingVertical: 10, borderBottomWidth: 1 },
  modalBtns: { marginTop: 20, gap: 10 },
  liveTag: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFF" },
  serviceAreaBanner: { marginHorizontal: 16, marginTop: 12, marginBottom: 2, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 10 },
  serviceAreaWarning: { alignItems: "center" },
  serviceAreaIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  serviceAreaText: { flex: 1 },
  catBanner: { marginHorizontal: 16, marginTop: 8, marginBottom: 2, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 10 },
});
