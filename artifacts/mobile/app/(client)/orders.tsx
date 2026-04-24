import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator, Linking, Image, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
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
  const { getOrdersByClient, syncOrders } = useOrders();
  const { sessionToken, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"active" | "history">("active");
  const [apiOrders, setApiOrders] = useState<Order[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrdersFromApi = useCallback(async () => {
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
        setApiOrders(fetched);
        syncOrders(fetched);
      }
    } catch {
    } finally {
      setLoadingApi(false);
    }
  }, [isAuthenticated, sessionToken, syncOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrdersFromApi();
    setRefreshing(false);
  }, [fetchOrdersFromApi]);

  useEffect(() => {
    fetchOrdersFromApi();
  }, [fetchOrdersFromApi]);

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

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: "/order-details", params: { orderId: item.id } })}
      activeOpacity={0.85}
    >
      <View style={[styles.accentBar, { backgroundColor: item.status === "completed" ? colors.success : item.status === "cancelled" ? colors.destructive : colors.secondary }]} />
      <View style={styles.cardBody}>
        <View style={[styles.cardTop, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, textAlign: isRTL ? "right" : "left" }}>
              {item.orderNumber}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
              {t(`cat.${item.category}`)} — {item.subCategory}
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Feather name="map-pin" size={13} color={colors.secondary} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: isRTL ? 0 : 5, marginRight: isRTL ? 5 : 0 }}>
            {item.street}, {t("order.floor")} {item.floor}
          </Text>
        </View>
        <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Feather name="calendar" size={13} color={colors.secondary} />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: isRTL ? 0 : 5, marginRight: isRTL ? 5 : 0 }}>
            {item.visitDate} — {item.visitTime}
          </Text>
        </View>
        {item.createdAt && (
          <View style={[styles.infoRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Feather name="clock" size={13} color={colors.secondary} />
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
                <Feather name="star" size={11} color={colors.primary} />
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
                  <Feather name="phone" size={14} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smsBtn, { backgroundColor: colors.secondary, borderRadius: 8, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }]}
                  onPress={(e) => { e.stopPropagation(); Linking.openURL(`sms:${item.technicianMobile}`).catch(() => {}); }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="message-circle" size={14} color="#FFF" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("nav.orders")}
        rightElement={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}
            onPress={() => router.push("/(client)/home")}
          >
            <Feather name="plus" size={18} color="#FFF" />
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
                  <Feather name="clipboard" size={40} color={colors.primary} />
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
                  <Feather name="plus-circle" size={16} color="#FFF" />
                  <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15, marginLeft: 8 }}>
                    {t("order.bookService")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 40 }]}>
                  <Feather name="inbox" size={40} color={colors.mutedForeground} />
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
  addBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  tabBar: { margin: 12, padding: 4, borderRadius: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  tabBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: { marginBottom: 12, borderWidth: 1.5, flexDirection: "row", overflow: "hidden", shadowColor: "#0D1B2A", shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { alignItems: "flex-start", marginBottom: 10, gap: 8 },
  infoRow: { alignItems: "center", marginBottom: 5, gap: 0 },
  techRow: { alignItems: "center", marginTop: 10, borderTopWidth: 1, paddingTop: 10, gap: 0 },
  techAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ratingChip: { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 8 },
  callBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  smsBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60 },
  bookBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 28, marginTop: 24 },
  emptyIcon: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
});
