import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import VectorIcon, { type IconName } from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/context/OrderContext";
import { useTechWs } from "@/context/TechWsContext";
import AppHeader from "@/components/AppHeader";
import FanniButton from "@/components/FanniButton";
import Toast from "@/components/Toast";
import { useRouter } from "expo-router";
import { getApiBase } from "@/utils/api";


const CATEGORY_ICONS: Record<string, IconName> = {
  electricity: "zap",
  plumbing: "droplet",
  ac: "wind",
  carpentry: "tool",
  appliances: "cpu",
  painting: "edit-3",
  pest: "alert-triangle",
  flooring: "grid",
};

interface PendingOrder {
  id: string;
  orderNumber: string;
  orderSerial: number;
  category: string;
  subCategory: string | null;
  governorate: string | null;
  area: string | null;
  street: string | null;
  floor: string | null;
  building: string | null;
  visitDate: string | null;
  visitTime: string | null;
  problemDescription: string | null;
  deviceType: string | null;
  createdAt: string;
  isUnlocked?: boolean;
  unlockCost?: number;
}

interface UnlockContact {
  clientName?: string | null;
  clientMobile?: string | null;
  street?: string | null;
  building?: string | null;
  floor?: string | null;
  landmark?: string | null;
}

export default function AvailableOrdersScreen() {
  const colors = useColors();
  const { t, isRTL, user } = useApp();
  const { sessionToken } = useAuth();
  const { updateOrder, setAvailablePendingCount, wsOrderStatusSignal, availableOrdersTabFocusedRef } = useOrders();
  const router = useRouter();

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOrdersToast, setNewOrdersToast] = useState<{ visible: boolean; added: number; key: number }>({ visible: false, added: 0, key: 0 });
  const [cancelledToast, setCancelledToast] = useState<{ visible: boolean; key: number }>({ visible: false, key: 0 });
  const [acceptError, setAcceptError] = useState<string | null>(null);
  // Points unlock state: orderId → contact info
  const [unlockedContacts, setUnlockedContacts] = useState<Record<string, UnlockContact>>({});
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const isFocusedRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevOrderCountRef = useRef<number>(0);
  const acceptingIdRef = useRef<string | null>(null);
  const cancelledWhileAcceptingRef = useRef(false);

  const fetchOrders = useCallback(async (isRefresh = false, silent = false) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) {
      setOrders([]);
      setAvailablePendingCount(0);
      return;
    }
    let didSetLoading = false;
    let didSetRefreshing = false;
    if (!silent) {
      if (isRefresh) {
        setRefreshing(true);
        didSetRefreshing = true;
      } else {
        setLoading(true);
        didSetLoading = true;
      }
    }
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/technician/pending-orders?limit=50`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { orders: PendingOrder[]; meta?: { total: number } };
      const fetched = json.orders ?? [];
      setOrders(fetched);
      setAvailablePendingCount(isFocusedRef.current ? 0 : (json.meta?.total ?? fetched.length));
      if (silent) {
        const added = fetched.length - prevOrderCountRef.current;
        if (added > 0) {
          setNewOrdersToast((prev) => ({ visible: true, added, key: prev.key + 1 }));
        }
      }
      prevOrderCountRef.current = fetched.length;
    } catch (err) {
      console.warn("[Fanni] Failed to fetch pending orders:", err);
      setError(isRTL ? "تعذّر تحميل الطلبات المتاحة" : "Could not load available orders");
    } finally {
      if (didSetLoading) setLoading(false);
      if (didSetRefreshing) setRefreshing(false);
    }
  }, [sessionToken, isRTL]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      availableOrdersTabFocusedRef.current = true;
      setAvailablePendingCount(0);
      fetchOrders();
      pollTimerRef.current = setInterval(() => {
        if (isFocusedRef.current) {
          fetchOrders(false, true);
        }
      }, 60_000);
      return () => {
        isFocusedRef.current = false;
        availableOrdersTabFocusedRef.current = false;
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };
    }, [fetchOrders, availableOrdersTabFocusedRef])
  );

  const silentFetchRef = useRef<() => void>(() => {});
  silentFetchRef.current = () => {
    if (isFocusedRef.current) {
      fetchOrders(false, true);
    }
  };

  useEffect(() => {
    if (wsOrderStatusSignal === 0) return;
    const timer = setTimeout(() => {
      silentFetchRef.current();
    }, 400);
    return () => clearTimeout(timer);
  }, [wsOrderStatusSignal]);

  const { subscribeNewOrder, subscribeOrderCancelled } = useTechWs();

  const onNewOrderCallback = useCallback(() => {
    silentFetchRef.current();
  }, []);

  const onOrderCancelledCallback = useCallback((orderId: string) => {
    if (acceptingIdRef.current === orderId) {
      cancelledWhileAcceptingRef.current = true;
    }
    setOrders((prev) => {
      const wasVisible = prev.some((o) => o.id === orderId);
      if (wasVisible) {
        setCancelledToast((p) => ({ visible: true, key: p.key + 1 }));
      }
      const next = prev.filter((o) => o.id !== orderId);
      if (next.length !== prev.length) {
        prevOrderCountRef.current = next.length;
        setAvailablePendingCount(isFocusedRef.current ? 0 : next.length);
      }
      return next;
    });
  }, [setAvailablePendingCount]);

  useEffect(() => subscribeNewOrder(onNewOrderCallback), [subscribeNewOrder, onNewOrderCallback]);
  useEffect(() => subscribeOrderCancelled(onOrderCancelledCallback), [subscribeOrderCancelled, onOrderCancelledCallback]);

  const handleUnlock = async (order: PendingOrder) => {
    const apiBase = getApiBase();
    if (!apiBase || !sessionToken) return;
    setUnlockingId(order.id);
    setUnlockError(null);
    try {
      const res = await fetch(`${apiBase}/api/orders/${order.id}/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      const json = await res.json() as { contact?: UnlockContact; newBalance?: number; error?: string; alreadyUnlocked?: boolean };
      if (res.ok && json.contact) {
        setUnlockedContacts((prev) => ({ ...prev, [order.id]: json.contact! }));
        setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, isUnlocked: true } : o));
      } else if (res.status === 402) {
        Alert.alert(
          isRTL ? "رصيد غير كافٍ" : "Insufficient Points",
          isRTL
            ? `رصيدك ${json.error?.includes("balance") ? "" : ""}غير كافٍ لفتح هذا الطلب. يرجى شراء نقاط إضافية من المحفظة.`
            : "Your points balance is insufficient. Please buy more points from your wallet.",
          [{ text: isRTL ? "حسناً" : "OK" }],
        );
      } else {
        setUnlockError(json.error ?? (isRTL ? "تعذّر فتح الطلب" : "Could not unlock order"));
      }
    } catch {
      setUnlockError(isRTL ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setUnlockingId(null);
    }
  };

  const handleCallClient = async (orderId: string, mobile: string) => {
    const apiBase = getApiBase();
    if (apiBase && sessionToken) {
      fetch(`${apiBase}/api/orders/${orderId}/unlock/track`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "call" }),
      }).catch(() => {});
    }
    const tel = `tel:${mobile.replace(/\D/g, "")}`;
    Linking.openURL(tel).catch(() => {});
  };

  const handleWhatsapp = async (orderId: string, mobile: string) => {
    const apiBase = getApiBase();
    if (apiBase && sessionToken) {
      fetch(`${apiBase}/api/orders/${orderId}/unlock/track`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: "whatsapp" }),
      }).catch(() => {});
    }
    const phone = mobile.replace(/\D/g, "");
    const wa = `https://wa.me/2${phone.startsWith("0") ? phone.slice(1) : phone}`;
    Linking.openURL(wa).catch(() => {});
  };

  const handleAccept = async (order: PendingOrder) => {
    setAcceptingId(order.id);
    acceptingIdRef.current = order.id;
    cancelledWhileAcceptingRef.current = false;
    setAcceptError(null);
    try {
      const apiBase = getApiBase();
      if (apiBase && sessionToken) {
        const res = await fetch(`${apiBase}/api/orders/${order.id}/acknowledge`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            technicianName: user?.name ?? "",
            technicianMobile: user?.mobile ?? "",
            technicianAvatar: user?.avatar,
            technicianRating: 4.8,
          }),
        });
        if (res.ok) {
          await updateOrder(order.id, {
            status: "accepted",
            technicianId: user?.id ?? "",
            technicianName: user?.name ?? "",
            technicianMobile: user?.mobile ?? "",
            technicianAvatar: user?.avatar,
            technicianRating: 4.8,
          });
          setOrders((prev) => {
            const next = prev.filter((o) => o.id !== order.id);
            prevOrderCountRef.current = next.length;
            setAvailablePendingCount(isFocusedRef.current ? 0 : next.length);
            return next;
          });
          router.push("/(tech)/orders");
        } else {
          console.warn("[Fanni] Acknowledge failed:", res.status);
          if (!cancelledWhileAcceptingRef.current) {
            setAcceptError(isRTL ? "تعذّر قبول الطلب. يُرجى المحاولة مرة أخرى." : "Could not accept this order. Please try again.");
          }
        }
      }
    } catch (err) {
      console.warn("[Fanni] Accept error:", err);
      if (!cancelledWhileAcceptingRef.current) {
        setAcceptError(isRTL ? "خطأ في الاتصال. يُرجى المحاولة مرة أخرى." : "Connection error. Please try again.");
      }
    } finally {
      setAcceptingId(null);
      acceptingIdRef.current = null;
    }
  };

  const renderItem = ({ item }: { item: PendingOrder }) => {
    const iconName: IconName = CATEGORY_ICONS[item.category] ?? "tool";
    const isAccepting = acceptingId === item.id;
    const isUnlocking = unlockingId === item.id;
    const contact = unlockedContacts[item.id];
    const isUnlocked = item.isUnlocked === true || !!contact;
    const unlockCost = item.unlockCost ?? 15;
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isUnlocked ? colors.primary + "60" : colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={[styles.cardAccent, { backgroundColor: isUnlocked ? colors.primary : colors.mutedForeground + "60" }]} />
        <View style={styles.cardBody}>
          <View style={[styles.cardHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View style={[styles.categoryIcon, { backgroundColor: colors.primary + "18" }]}>
              <VectorIcon name={iconName} size={18} color={colors.primary} />
            </View>
            <View style={[styles.cardHeaderText, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 14,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {item.orderNumber}
              </Text>
              <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                {t(`cat.${item.category}`)}
                {item.subCategory ? ` — ${item.subCategory}` : ""}
              </Text>
            </View>
          </View>

          {item.problemDescription ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                marginTop: 8,
                textAlign: isRTL ? "right" : "left",
              }}
              numberOfLines={2}
            >
              {item.problemDescription}
            </Text>
          ) : null}

          <View style={[styles.metaRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <VectorIcon name="map-pin" size={12} color={colors.secondary} />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                marginLeft: isRTL ? 0 : 5,
                marginRight: isRTL ? 5 : 0,
                flex: 1,
                textAlign: isRTL ? "right" : "left",
              }}
              numberOfLines={1}
            >
              {[item.area, item.street].filter(Boolean).join(", ") || (isRTL ? "غير محدد" : "Unknown")}
            </Text>
          </View>

          {item.visitDate ? (
            <View style={[styles.metaRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <VectorIcon name="calendar" size={12} color={colors.secondary} />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  marginLeft: isRTL ? 0 : 5,
                  marginRight: isRTL ? 5 : 0,
                }}
              >
                {item.visitDate} {item.visitTime ?? ""}
              </Text>
            </View>
          ) : null}

          {/* Lock / Unlock state */}
          {!isUnlocked ? (
            <>
              <View
                style={[
                  styles.lockedBanner,
                  {
                    backgroundColor: colors.muted + "40",
                    borderRadius: colors.radius - 4,
                    flexDirection: isRTL ? "row-reverse" : "row",
                  },
                ]}
              >
                <VectorIcon name="lock" size={14} color={colors.mutedForeground} />
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                    marginLeft: isRTL ? 0 : 6,
                    marginRight: isRTL ? 6 : 0,
                    flex: 1,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {t("wallet.lockedHint")}
                </Text>
              </View>
              <FanniButton
                title={
                  isUnlocking
                    ? t("wallet.unlocking")
                    : `🔓 ${t("wallet.unlockFor")} ${unlockCost} ${t("wallet.points")}`
                }
                onPress={() => handleUnlock(item)}
                loading={isUnlocking}
                style={{ marginTop: 10 }}
              />
            </>
          ) : (
            <>
              {/* Revealed contact details */}
              {contact && (
                <View
                  style={[
                    styles.contactBox,
                    {
                      backgroundColor: "#f0fdf4",
                      borderRadius: colors.radius - 4,
                      borderColor: "#86efac",
                    },
                  ]}
                >
                  <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginBottom: 4 }]}>
                    <VectorIcon name="unlock" size={13} color="#16a34a" />
                    <Text
                      style={{
                        color: "#16a34a",
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 12,
                        marginLeft: isRTL ? 0 : 5,
                        marginRight: isRTL ? 5 : 0,
                      }}
                    >
                      {t("wallet.contactRevealed")}
                    </Text>
                  </View>
                  {contact.clientName ? (
                    <Text style={{ color: "#166534", fontFamily: "Inter_500Medium", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                      {contact.clientName}
                    </Text>
                  ) : null}
                  {contact.clientMobile ? (
                    <Text style={{ color: "#166534", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                      {contact.clientMobile}
                    </Text>
                  ) : null}
                  {contact.street ? (
                    <Text style={{ color: "#166534", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: isRTL ? "right" : "left" }} numberOfLines={1}>
                      {[contact.street, contact.building && `${isRTL ? "مبنى" : "Bldg"} ${contact.building}`, contact.floor && `${isRTL ? "دور" : "Fl"} ${contact.floor}`].filter(Boolean).join(", ")}
                    </Text>
                  ) : null}
                  {contact.clientMobile ? (
                    <View style={[styles.contactActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                      <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: "#16a34a" }]}
                        onPress={() => handleCallClient(item.id, contact.clientMobile!)}
                      >
                        <VectorIcon name="phone" size={14} color="#fff" />
                        <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                          {t("wallet.callClient")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: "#25D366" }]}
                        onPress={() => handleWhatsapp(item.id, contact.clientMobile!)}
                      >
                        <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                          {t("wallet.whatsapp")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}
              <FanniButton
                title={isRTL ? "قبول الطلب" : "Accept Order"}
                onPress={() => handleAccept(item)}
                loading={isAccepting}
                style={{ marginTop: 10 }}
              />
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "الطلبات المتاحة" : "Available Orders"}
        subtitle={
          orders.length > 0
            ? isRTL
              ? `${orders.length} طلب في منطقتك`
              : `${orders.length} order${orders.length !== 1 ? "s" : ""} in your area`
            : undefined
        }
        showLangToggle
      />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 12 }}>
            {isRTL ? "جارٍ التحميل…" : "Loading…"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {error ? (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: "#FEF2F2" }]}>
                    <VectorIcon name="alert-circle" size={32} color="#EF4444" />
                  </View>
                  <Text style={{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 12, textAlign: "center" }}>
                    {error}
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { borderColor: colors.primary }]}
                    onPress={() => fetchOrders()}
                  >
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {isRTL ? "إعادة المحاولة" : "Retry"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.accent, borderRadius: 40 }]}>
                    <VectorIcon name="clock" size={40} color={colors.primary} />
                  </View>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, marginTop: 16, textAlign: "center" }}>
                    {t("tech.noAvailableOrders")}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 6, textAlign: "center", paddingHorizontal: 16 }}>
                    {t("tech.noAvailableOrdersHint")}
                  </Text>
                  <TouchableOpacity
                    style={[styles.profileBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                    onPress={() => router.push("/(tech)/profile")}
                    activeOpacity={0.85}
                  >
                    <VectorIcon name="map-pin" size={16} color="#FFF" />
                    <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15, marginLeft: 8 }}>
                      {t("tech.setServiceArea")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.retryBtn, { borderColor: colors.border, marginTop: 10 }]}
                    onPress={() => fetchOrders()}
                  >
                    <VectorIcon name="refresh-cw" size={14} color={colors.mutedForeground} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                      {isRTL ? "تحديث" : "Refresh"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
        />
      )}
      <Toast
        key={newOrdersToast.key}
        visible={newOrdersToast.visible}
        message={
          isRTL
            ? newOrdersToast.added === 1
              ? "طلب جديد متاح"
              : `${newOrdersToast.added} طلبات جديدة متاحة`
            : newOrdersToast.added === 1
            ? "1 new order available"
            : `${newOrdersToast.added} new orders available`
        }
        duration={3000}
        variant="success"
        onHide={() => setNewOrdersToast((prev) => ({ ...prev, visible: false, added: 0 }))}
      />
      <Toast
        key={`cancelled-${cancelledToast.key}`}
        visible={cancelledToast.visible}
        message={isRTL ? "تم إلغاء هذا الطلب من قِبَل العميل" : "This order has been cancelled by the client"}
        duration={4000}
        variant="error"
        onHide={() => setCancelledToast((prev) => ({ ...prev, visible: false }))}
      />
      <Toast
        key={`accept-err-${acceptError ?? ""}`}
        visible={!!acceptError}
        message={acceptError ?? ""}
        duration={3500}
        variant="error"
        onHide={() => setAcceptError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "web" ? 100 : 90,
    gap: 12,
  },
  card: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1.5,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: { alignItems: "flex-start", gap: 10 },
  cardHeaderText: { flex: 1 },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: { alignItems: "center", marginTop: 6 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  profileBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 12,
  },
  lockedBanner: {
    padding: 8,
    marginTop: 10,
    alignItems: "center",
    gap: 4,
  },
  contactBox: {
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    gap: 3,
  },
  contactActions: {
    gap: 8,
    marginTop: 8,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
});
