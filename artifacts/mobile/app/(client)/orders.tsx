import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator, Linking, Image, RefreshControl, Animated } from "react-native";
import { shareLegacyInvoicePdf } from "@/utils/invoicePdf";
import SUB_IMAGE_MAP from "@/constants/subImageMap";
import { useRouter } from "expo-router";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders, Order } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import AppHeader from "@/components/AppHeader";

function getApiBaseUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "";
}

export default function ClientOrdersScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { getOrdersByClient, syncOrders, wsOrderStatusSignal } = useOrders();
  const { sessionToken, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"active" | "history">("active");
  const [apiOrders, setApiOrders] = useState<Order[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedOrderIds, setUpdatedOrderIds] = useState<Set<string>>(new Set());
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const highlightAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const flashUpdatedBadges = useCallback((ids: Set<string>) => {
    if (ids.size === 0) return;
    if (highlightAnimRef.current) {
      highlightAnimRef.current.stop();
      highlightAnimRef.current = null;
    }
    setUpdatedOrderIds((prev) => new Set([...prev, ...ids]));
    badgeOpacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(badgeOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(badgeOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]);
    highlightAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        setUpdatedOrderIds(new Set());
        badgeOpacity.setValue(0);
        highlightAnimRef.current = null;
      }
    });
  }, [badgeOpacity]);

  const fetchOrdersFromApi = useCallback(async (detectChanges = false) => {
    if (!isAuthenticated || !sessionToken) return;
    const base = getApiBaseUrl();
    if (!base) return;

    setLoadingApi(true);
    try {
      const res = await fetch(`${base}/api/orders`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const fetched = (data.orders ?? []) as Order[];

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
        setApiOrders(fetched);
        syncOrders(fetched);
      }
    } catch {
    } finally {
      setLoadingApi(false);
    }
  }, [isAuthenticated, sessionToken, syncOrders, flashUpdatedBadges]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrdersFromApi(false);
    setRefreshing(false);
  }, [fetchOrdersFromApi]);

  useEffect(() => {
    fetchOrdersFromApi(false);
  }, [fetchOrdersFromApi]);

  useEffect(() => {
    return () => {
      if (highlightAnimRef.current) {
        highlightAnimRef.current.stop();
        highlightAnimRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (wsOrderStatusSignal === 0) return;
    const timer = setTimeout(() => {
      fetchOrdersFromApi(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [wsOrderStatusSignal, fetchOrdersFromApi]);

  const localOrders = getOrdersByClient(user?.id ?? "client1");

  const mergedOrders: Order[] = isAuthenticated
    ? (() => {
        const contextIds = new Set(localOrders.map((o) => o.id));
        const apiOnly = apiOrders.filter((o) => !contextIds.has(o.id));
        return [...localOrders, ...apiOnly];
      })()
    : localOrders;

  const activeOrders = mergedOrders.filter((o) => ["pending", "accepted", "inProgress"].includes(o.status));
  const historyOrders = mergedOrders.filter((o) => ["completed", "cancelled"].includes(o.status));
  const displayOrders = tab === "active" ? activeOrders : historyOrders;

  const handleShareInvoice = useCallback(async (item: Order) => {
    await shareLegacyInvoicePdf({ order: item, isRTL, t });
  }, [isRTL, t]);

  const renderOrder = ({ item }: { item: Order }) => {
    const isUpdated = updatedOrderIds.has(item.id);
    return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
        onPress={() => router.push({ pathname: "/order-details", params: { orderId: item.id } })}
        activeOpacity={0.85}
      >
      <View style={[styles.accentBar, { backgroundColor: item.status === "completed" ? colors.success : item.status === "cancelled" ? colors.destructive : colors.secondary }]} />
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
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
              {item.orderNumber}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
              {t(`cat.${item.category}`)} — {item.subCategory}
            </Text>
          </View>
          <StatusBadge status={item.status} />
          {item.status === "completed" && item.invoice && (
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.accent, borderRadius: 8 }]}
              onPress={(e) => { e.stopPropagation(); handleShareInvoice(item); }}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <VectorIcon name="share-2" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <VectorIcon name="map-pin" size={13} color={colors.secondary} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: isRTL ? 0 : 5, marginRight: isRTL ? 5 : 0 }}>
            {item.street}, {t("order.floor")} {item.floor}
          </Text>
        </View>
        <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <VectorIcon name="calendar" size={13} color={colors.secondary} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: isRTL ? 0 : 5, marginRight: isRTL ? 5 : 0 }}>
            {item.visitDate} — {item.visitTime}
          </Text>
        </View>
        {item.createdAt && (
          <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <VectorIcon name="clock" size={13} color={colors.secondary} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: isRTL ? 0 : 5, marginRight: isRTL ? 5 : 0 }}>
              {new Date(item.createdAt).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
            </Text>
          </View>
        )}
        {(item.technicianName || item.technicianMobile) && (
          <View style={[styles.techRow, { borderTopColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            {item.technicianName && (
              <>
                {item.technicianAvatar ? (
                  <Image source={{ uri: item.technicianAvatar }} style={styles.techAvatar} />
                ) : (
                  <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 12 }}>{item.technicianName[0]}</Text>
                  </View>
                )}
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0, textAlign: isRTL ? "right" : "left" }}>
                  {item.technicianName}
                </Text>
              </>
            )}
            {!item.technicianName && <View style={{ flex: 1 }} />}
            {item.technicianRating && (
              <View style={[styles.ratingChip, { backgroundColor: colors.accent, borderRadius: 8 }]}>
                <VectorIcon name="star" size={11} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 3 }}>{item.technicianRating}</Text>
              </View>
            )}
            {item.technicianMobile && ["pending", "accepted", "inProgress"].includes(item.status) && (
              <>
                <TouchableOpacity
                  style={[styles.callBtn, { backgroundColor: colors.primary, borderRadius: 8, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}
                  onPress={(e) => { e.stopPropagation(); Linking.openURL(`tel:${item.technicianMobile}`).catch(() => {}); }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <VectorIcon name="phone" size={14} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smsBtn, { backgroundColor: colors.secondary, borderRadius: 8, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }]}
                  onPress={(e) => { e.stopPropagation(); Linking.openURL(`sms:${item.technicianMobile}`).catch(() => {}); }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <VectorIcon name="message-circle" size={14} color="#FFF" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
      </TouchableOpacity>
      {isUpdated && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: colors.radius, borderWidth: 1.5, borderColor: "#F59E0B", opacity: badgeOpacity },
          ]}
        />
      )}
    </View>
  );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("nav.orders")}
        rightElement={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}
            onPress={() => router.push("/(client)/home")}
          >
            <VectorIcon name="plus" size={18} color="#FFF" />
          </TouchableOpacity>
        }
      />

      <View style={[styles.tabBar, { backgroundColor: colors.card, flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {([["active", t("order.active")], ["history", t("order.history")]] as [string, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, { backgroundColor: tab === key ? colors.primary : "transparent", borderRadius: colors.radius - 4 }]}
            onPress={() => setTab(key as "active" | "history")}
          >
            <Text style={{ color: tab === key ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
              {label}
            </Text>
            {tab === key && (
              <View style={[styles.tabBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11 }}>
                  {key === "active" ? activeOrders.length : historyOrders.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loadingApi && apiOrders.length === 0 && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 90 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            isAuthenticated && mergedOrders.length === 0 ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.accent, borderRadius: 40 }]}>
                  <VectorIcon name="clipboard" size={40} color={colors.primary} />
                </View>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 16, textAlign: "center" }}>
                  {t("order.noOrdersYet")}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 6, textAlign: "center", paddingHorizontal: 32 }}>
                  {t("order.noOrdersHint")}
                </Text>
                <TouchableOpacity
                  style={[styles.bookBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                  onPress={() => router.push("/(client)/home")}
                  activeOpacity={0.85}
                >
                  <VectorIcon name="plus-circle" size={16} color="#FFF" />
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15, marginLeft: 8 }}>
                    {t("order.bookService")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 40 }]}>
                  <VectorIcon name="inbox" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15, marginTop: 14, textAlign: "center" }}>
                  {t("common.noData")}
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cardWrapper: { marginBottom: 12 },
  addBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  tabBar: { margin: 12, padding: 4, borderRadius: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  tabBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: { borderWidth: 1.5, flexDirection: "row", overflow: "hidden", shadowColor: "#0D1B2A", shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { alignItems: "center", marginBottom: 10, gap: 8 },
  subThumb: { width: 44, height: 44, borderWidth: 1 },
  infoRow: { alignItems: "center", marginBottom: 5, gap: 0 },
  techRow: { alignItems: "center", marginTop: 10, borderTopWidth: 1, paddingTop: 10, gap: 0 },
  techAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ratingChip: { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 8 },
  callBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  smsBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  shareBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60 },
  bookBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 28, marginTop: 24 },
  emptyIcon: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  updatedBadge: { backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#F59E0B", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  updatedBadgeText: { color: "#B45309", fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.3 },
});
