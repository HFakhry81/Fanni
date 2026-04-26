import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Linking,
  Animated,
  Share,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import { useColors, type AppColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useOrders, Order } from "@/context/OrderContext";
import {
  RouteData,
  readPersistedRoute,
  writePersistedRoute,
} from "@/utils/routeCache";

const ALEX = { lat: 31.2001, lng: 29.9187 };
const TECH_START_OFFSET = 0.018;

const ROUTE_CACHE = new Map<string, RouteData | null>();

const _savedWebMapState: Record<string, { zoom: number; cx: number; cy: number }> = {};
const _savedNativeRegion: Record<string, { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }> = {};

function routeCacheKey(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(startLat)},${r(startLng)};${r(endLat)},${r(endLng)}`;
}

async function fetchOSRMRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteData | null> {
  const key = routeCacheKey(startLat, startLng, endLat, endLng);
  if (ROUTE_CACHE.has(key)) {
    return ROUTE_CACHE.get(key) ?? null;
  }
  const persisted = await readPersistedRoute(key);
  if (persisted) {
    ROUTE_CACHE.set(key, persisted);
    return persisted;
  }
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) {
      return null;
    }
    const route = data.routes[0];
    const coords = (route.geometry.coordinates as [number, number][]).map(
      ([lng, lat]) => ({ lat, lng })
    );
    const result: RouteData = { coords, durationSec: route.duration, distanceM: route.distance };
    ROUTE_CACHE.set(key, result);
    writePersistedRoute(key, result);
    return result;
  } catch {
    return null;
  }
}

function interpolateAlongRoute(
  coords: Array<{ lat: number; lng: number }>,
  progress: number
): { lat: number; lng: number } {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  if (coords.length === 1 || progress >= 1) return coords[coords.length - 1];
  if (progress <= 0) return coords[0];

  const distances: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const dlat = coords[i].lat - coords[i - 1].lat;
    const dlng = coords[i].lng - coords[i - 1].lng;
    distances.push(distances[i - 1] + Math.sqrt(dlat * dlat + dlng * dlng));
  }
  const total = distances[distances.length - 1];
  const target = progress * total;

  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= target) {
      const segStart = distances[i - 1];
      const segEnd = distances[i];
      const t = segEnd === segStart ? 0 : (target - segStart) / (segEnd - segStart);
      return {
        lat: coords[i - 1].lat + t * (coords[i].lat - coords[i - 1].lat),
        lng: coords[i - 1].lng + t * (coords[i].lng - coords[i - 1].lng),
      };
    }
  }
  return coords[coords.length - 1];
}

function getRemainingRoute(
  coords: Array<{ lat: number; lng: number }>,
  progress: number,
  currentLat: number,
  currentLng: number
): Array<{ lat: number; lng: number }> {
  if (coords.length === 0) return [];
  if (progress <= 0) return coords;
  if (progress >= 1) return [{ lat: currentLat, lng: currentLng }];

  const distances: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const dlat = coords[i].lat - coords[i - 1].lat;
    const dlng = coords[i].lng - coords[i - 1].lng;
    distances.push(distances[i - 1] + Math.sqrt(dlat * dlat + dlng * dlng));
  }
  const total = distances[distances.length - 1];
  const target = progress * total;

  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= target) {
      return [{ lat: currentLat, lng: currentLng }, ...coords.slice(i)];
    }
  }
  return [{ lat: currentLat, lng: currentLng }];
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


interface MapProps {
  order: Order;
  techLat: number;
  techLng: number;
  clientLat: number;
  clientLng: number;
  routeCoords: Array<{ lat: number; lng: number }>;
}

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();
  const { orders, updateOrder } = useOrders();
  const insets = useSafeAreaInsets();

  const order = orders.find((o) => o.id === orderId);

  const clientLat = order?.latitude ?? ALEX.lat;
  const clientLng = order?.longitude ?? ALEX.lng;

  const techStartLat = clientLat - TECH_START_OFFSET;
  const techStartLng = clientLng - TECH_START_OFFSET;

  const [techLat, setTechLat] = useState(techStartLat);
  const [techLng, setTechLng] = useState(techStartLng);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);

  const [arrived, setArrived] = useState(false);
  const [jobStarted, setJobStarted] = useState(order?.status === "inProgress");
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleConfirmArrival = useCallback(async () => {
    if (!orderId || confirmingArrival) return;
    const domain = process.env["EXPO_PUBLIC_DOMAIN"];
    const apiBase = domain ? `https://${domain}` : "";
    if (!apiBase || !sessionToken) {
      Alert.alert(t("common.error"), t("order.confirmArrivalError"));
      return;
    }
    setConfirmingArrival(true);
    try {
      const res = await fetch(`${apiBase}/api/orders/${orderId}/confirm-arrival`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await updateOrder(orderId, { status: "inProgress" });
      setJobStarted(true);
    } catch {
      Alert.alert(t("common.error"), t("order.confirmArrivalError"));
    } finally {
      setConfirmingArrival(false);
    }
  }, [orderId, sessionToken, confirmingArrival, updateOrder, t]);

  const [displayEtaSec, setDisplayEtaSec] = useState<number | null>(null);
  const etaFromRouteRef = useRef(false);

  useEffect(() => {
    setDisplayEtaSec(null);
    etaFromRouteRef.current = false;
    progressRef.current = 0;
  }, [orderId]);

  useEffect(() => {
    if (order?.status === "completed" || order?.status === "cancelled") {
      delete _savedWebMapState[orderId];
      delete _savedNativeRegion[orderId];
    }
    if (order?.status === "inProgress") {
      setJobStarted(true);
    }
  }, [order?.status, orderId]);

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    fetchOSRMRoute(techStartLat, techStartLng, clientLat, clientLng).then((data) => {
      if (!cancelled) setRouteData(data);
    });
    return () => { cancelled = true; };
  }, [order, techStartLat, techStartLng, clientLat, clientLng]);

  useEffect(() => {
    if (!routeData) return;
    const sec = Math.max(0, Math.round(routeData.durationSec * (1 - progressRef.current)));
    setDisplayEtaSec(sec);
    etaFromRouteRef.current = true;
  }, [routeData]);

  useEffect(() => {
    if (!order || etaFromRouteRef.current) return;
    const distKm = haversineKm(techStartLat, techStartLng, clientLat, clientLng);
    const sec = Math.max(0, Math.round((distKm / 20) * 3600));
    setDisplayEtaSec(sec);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const ARRIVED_THRESHOLD = 1.0;

  useEffect(() => {
    if (!order) return;
    setArrived(false);
    intervalRef.current = setInterval(() => {
      progressRef.current = Math.min(progressRef.current + 0.005, ARRIVED_THRESHOLD);
      const p = progressRef.current;
      setProgress(p);

      if (p >= ARRIVED_THRESHOLD) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setArrived(true);
        setTechLat(clientLat);
        setTechLng(clientLng);
        return;
      }

      setDisplayEtaSec((prev) => (prev !== null ? Math.max(0, prev - 1) : null));

      if (routeData && routeData.coords.length > 1) {
        const pos = interpolateAlongRoute(routeData.coords, p);
        setTechLat(pos.lat);
        setTechLng(pos.lng);
      } else {
        setTechLat(
          techStartLat + (clientLat - 0.0005 - techStartLat) * p
        );
        setTechLng(
          techStartLng + (clientLng - 0.0005 - techStartLng) * p
        );
      }
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [order, clientLat, clientLng, techStartLat, techStartLng, routeData]);

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>{t("common.noData")}</Text>
      </View>
    );
  }

  const etaSec = displayEtaSec ?? 0;
  const etaMins = Math.floor(etaSec / 60);
  const etaRemSec = etaSec % 60;
  let remainingKm: number;
  if (routeData) {
    remainingKm = Math.max(0, (routeData.distanceM * (1 - progress)) / 1000);
  } else {
    remainingKm = haversineKm(techLat, techLng, clientLat, clientLng);
  }
  const distanceLabel = remainingKm >= 1
    ? `${remainingKm.toFixed(1)} ${t("order.km")}`
    : `${Math.round(remainingKm * 1000)} ${t("order.m")}`;

  let trafficLabel: "slow" | "fast" | null = null;
  if (routeData && routeData.durationSec > 0) {
    const baseSpeedMs = routeData.distanceM / routeData.durationSec;
    const variation = Math.sin(progress * Math.PI * 6) * 0.45;
    const currentSpeedKmh = baseSpeedMs * 3.6 * (1 + variation);
    if (currentSpeedKmh < 18) trafficLabel = "slow";
    else if (currentSpeedKmh > 55) trafficLabel = "fast";
  }

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const routeCoords = routeData
    ? getRemainingRoute(routeData.coords, progress, techLat, techLng)
    : [];
  const mapProps: MapProps = { order, techLat, techLng, clientLat, clientLng, routeCoords };

  const handleShare = useCallback(async () => {
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <VectorIcon name={isRTL ? "arrow-right" : "arrow-left"} size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {t("order.trackMap")}
        </Text>
        <TouchableOpacity
          onPress={handleShare}
          style={[styles.backBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t("order.shareTracking")}
        >
          <VectorIcon name="share-2" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {Platform.OS === "web" ? (
        <WebMapView {...mapProps} colors={colors} t={t} isRTL={isRTL} />
      ) : (
        <NativeMapView {...mapProps} />
      )}

      <View style={[styles.infoCard, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.legendRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: TECH_PIN_COLOR }]} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {t("order.techLocation")}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: CLIENT_PIN_COLOR }]} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {t("order.yourLocation")}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.routeLegendLine, { backgroundColor: TRAFFIC_COLOR_VERY_SLOW }]} />
            <View style={[styles.routeLegendLine, { backgroundColor: TRAFFIC_COLOR_SLOW }]} />
            <View style={[styles.routeLegendLine, { backgroundColor: TRAFFIC_COLOR_NORMAL }]} />
            <View style={[styles.routeLegendLine, { backgroundColor: TRAFFIC_COLOR_FAST }]} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {t("order.trafficLegend")}
            </Text>
          </View>
        </View>

        <View style={[styles.etaBanner, { backgroundColor: jobStarted ? "#E3F2FD" : arrived ? "#E8F5E9" : colors.accent, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap" }]}>
          {jobStarted ? (
            <>
              <VectorIcon name="tool" size={15} color="#1565C0" />
              <Text style={{ color: "#1565C0", fontFamily: "Inter_700Bold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                {t("order.jobInProgress")}
              </Text>
            </>
          ) : arrived ? (
            <>
              <VectorIcon name="check-circle" size={15} color="#2E7D32" />
              <Text style={{ color: "#2E7D32", fontFamily: "Inter_700Bold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                {t("order.technicianArrived")}
              </Text>
            </>
          ) : (
            <>
              <VectorIcon name="clock" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
                {displayEtaSec !== null && displayEtaSec <= 30
                  ? t("order.arrivingNow")
                  : `${t("order.arrivingIn")}${displayEtaSec === null ? "…" : `${etaMins > 0 ? `${etaMins} ${t("order.minutes")} ` : ""}${etaRemSec} ${t("order.seconds")}`}`}
              </Text>
              <View style={[styles.etaDivider, { backgroundColor: colors.primary }]} />
              <VectorIcon name="map-pin" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14, marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0 }}>
                {distanceLabel}
              </Text>
              {trafficLabel && (
                <>
                  <View style={[styles.etaDivider, { backgroundColor: colors.primary }]} />
                  <View style={[
                    styles.trafficBadge,
                    { backgroundColor: trafficLabel === "slow" ? "#FF6F00" : "#2E7D32" },
                  ]}>
                    <VectorIcon
                      name={trafficLabel === "slow" ? "alert-triangle" : "zap"}
                      size={11}
                      color="#FFF"
                    />
                    <Text style={styles.trafficBadgeText}>
                      {t(trafficLabel === "slow" ? "order.trafficSlow" : "order.trafficFast")}
                    </Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {arrived && !jobStarted && (
          <TouchableOpacity
            style={[styles.confirmArrivalBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: confirmingArrival ? 0.7 : 1 }]}
            onPress={handleConfirmArrival}
            activeOpacity={0.8}
            disabled={confirmingArrival}
          >
            {confirmingArrival ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <VectorIcon name="check-circle" size={18} color="#FFF" />
            )}
            <Text style={[styles.confirmArrivalText, { marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }]}>
              {t("order.confirmArrival")}
            </Text>
          </TouchableOpacity>
        )}

        {order.technicianName && (
          <View style={[styles.techRow, { flexDirection: isRTL ? "row-reverse" : "row", borderTopColor: colors.border }]}>
            {order.technicianAvatar ? (
              <Image
                source={{ uri: order.technicianAvatar }}
                style={[styles.techAvatar, { backgroundColor: colors.muted }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>{order.technicianName[0]}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                {order.technicianName}
              </Text>
              <Text style={{ color: jobStarted ? "#1565C0" : arrived ? "#2E7D32" : colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {jobStarted ? t("order.jobInProgress") : arrived ? t("order.technicianArrived") : t("order.onTheWay")}
              </Text>
            </View>
            {order.technicianRating && (
              <View style={[styles.ratingChip, { backgroundColor: colors.accent, borderRadius: 8 }]}>
                <VectorIcon name="star" size={12} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                  {order.technicianRating}
                </Text>
              </View>
            )}
          </View>
        )}

        {order.technicianMobile && (
          <View style={[styles.actionRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={() => Linking.openURL(`tel:${order.technicianMobile}`)}
              activeOpacity={0.8}
            >
              <VectorIcon name="phone" size={16} color="#FFF" />
              <Text style={[styles.callBtnText, { marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}>
                {t("order.callTech")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accent, borderRadius: colors.radius }]}
              onPress={() => Linking.openURL(`sms:${order.technicianMobile}`)}
              activeOpacity={0.8}
            >
              <VectorIcon name="message-circle" size={16} color={colors.primary} />
              <Text style={[styles.callBtnText, { color: colors.primary, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}>
                {t("order.messageTech")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const TECH_PIN_COLOR = "#1565C0";
const CLIENT_PIN_COLOR = "#E53935";
const ROUTE_COLOR = "#1565C0";
const TRAFFIC_COLOR_FAST = "#2E7D32";
const TRAFFIC_COLOR_NORMAL = "#1565C0";
const TRAFFIC_COLOR_SLOW = "#FF6F00";
const TRAFFIC_COLOR_VERY_SLOW = "#D32F2F";
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function getSegmentTrafficColor(segIdx: number): string {
  const noise = (Math.sin(segIdx * 1.8 + 0.7) + 1) / 2;
  if (noise < 0.12) return TRAFFIC_COLOR_VERY_SLOW;
  if (noise < 0.30) return TRAFFIC_COLOR_SLOW;
  if (noise > 0.82) return TRAFFIC_COLOR_FAST;
  return TRAFFIC_COLOR_NORMAL;
}

interface TrafficSegment {
  color: string;
  coords: Array<{ lat: number; lng: number }>;
}

function buildTrafficSegments(coords: Array<{ lat: number; lng: number }>): TrafficSegment[] {
  if (coords.length < 2) return [];
  const groups: TrafficSegment[] = [];
  let groupColor = getSegmentTrafficColor(0);
  let groupStart = 0;

  for (let i = 1; i <= coords.length - 2; i++) {
    const color = getSegmentTrafficColor(i);
    if (color !== groupColor) {
      groups.push({ color: groupColor, coords: coords.slice(groupStart, i + 1) });
      groupColor = color;
      groupStart = i;
    }
  }
  groups.push({ color: groupColor, coords: coords.slice(groupStart) });
  return groups;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;
const INITIAL_ZOOM = 14;

interface WebMapViewProps extends MapProps {
  colors: AppColors;
  t: (key: string) => string;
  isRTL: boolean;
}

function geoToWorld(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const radLat = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(radLat) + 1 / Math.cos(radLat)) / Math.PI) / 2) * scale;
  return { x, y };
}

function buildTileUrl(z: number, x: number, y: number): string {
  const maxTile = Math.pow(2, z);
  const nx = ((x % maxTile) + maxTile) % maxTile;
  const ny = Math.max(0, Math.min(maxTile - 1, y));
  return OSM_TILE_URL.replace("{z}", String(z)).replace("{x}", String(nx)).replace("{y}", String(ny));
}

function computeFit(
  techLat: number, techLng: number,
  clientLat: number, clientLng: number,
  w: number, h: number
): { zoom: number; cx: number; cy: number } {
  const padding = 72;
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const techW = geoToWorld(techLat, techLng, z);
    const clientW = geoToWorld(clientLat, clientLng, z);
    const minX = Math.min(techW.x, clientW.x);
    const maxX = Math.max(techW.x, clientW.x);
    const minY = Math.min(techW.y, clientW.y);
    const maxY = Math.max(techW.y, clientW.y);
    if (maxX - minX <= w - 2 * padding && maxY - minY <= h - 2 * padding) {
      return { zoom: z, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    }
  }
  const techW = geoToWorld(techLat, techLng, MIN_ZOOM);
  const clientW = geoToWorld(clientLat, clientLng, MIN_ZOOM);
  return { zoom: MIN_ZOOM, cx: (techW.x + clientW.x) / 2, cy: (techW.y + clientW.y) / 2 };
}

function WebMapView({ order, techLat, techLng, clientLat, clientLng, routeCoords, colors, t, isRTL }: WebMapViewProps) {
  const initialFit = computeFit(techLat, techLng, clientLat, clientLng, 400, 400);

  const savedWeb = _savedWebMapState[order.id] ?? null;
  const zoomRef = useRef(savedWeb?.zoom ?? initialFit.zoom);
  const centerRef = useRef(
    savedWeb
      ? { x: savedWeb.cx, y: savedWeb.cy }
      : { x: initialFit.cx, y: initialFit.cy }
  );
  const [, setRenderTick] = useState(0);
  const imperativeUpdatePinsRef = useRef<() => void>(() => {});
  const triggerRender = useCallback(() => {
    _savedWebMapState[order.id] = { zoom: zoomRef.current, cx: centerRef.current.x, cy: centerRef.current.y };
    imperativeUpdatePinsRef.current();
    setRenderTick((n) => n + 1);
  }, [order.id]);

  const smoothRouteFirstRef = useRef({ lat: techLat, lng: techLng });
  const routeAnimFromRef = useRef({ lat: techLat, lng: techLng });
  const routeAnimToRef = useRef({ lat: techLat, lng: techLng });
  const routeAnimStartRef = useRef<number | null>(null);
  const routeRafRef = useRef<number | null>(null);
  const segmentPolylineRefsRef = useRef<Array<SVGPolylineElement | null>>([]);
  const routeCoordsRef = useRef(routeCoords);

  useEffect(() => {
    routeCoordsRef.current = routeCoords;
  }, [routeCoords]);

  useEffect(() => {
    routeAnimFromRef.current = { ...smoothRouteFirstRef.current };
    routeAnimToRef.current = { lat: techLat, lng: techLng };
    routeAnimStartRef.current = performance.now();
  }, [techLat, techLng]);

  const startRouteRaf = useCallback(() => {
    if (Platform.OS !== "web") return;
    if (routeRafRef.current) cancelAnimationFrame(routeRafRef.current);
    const DURATION = 950;
    const PIN_HALF = 14;
    const tick = (now: number) => {
      if (routeAnimStartRef.current !== null) {
        const t = Math.min(1, (now - routeAnimStartRef.current) / DURATION);
        const from = routeAnimFromRef.current;
        const to = routeAnimToRef.current;
        smoothRouteFirstRef.current = {
          lat: from.lat + (to.lat - from.lat) * t,
          lng: from.lng + (to.lng - from.lng) * t,
        };

        const segRefs = segmentPolylineRefsRef.current;
        const coords = routeCoordsRef.current;
        if (segRefs.length > 0 && coords.length > 1) {
          const zoom = zoomRef.current;
          const cx = centerRef.current.x;
          const cy = centerRef.current.y;
          const { w: mapW, h: mapH } = sizeRef.current;
          const toScreenLocal = (lat: number, lng: number) => {
            const wld = geoToWorld(lat, lng, zoom);
            return { x: wld.x - cx + mapW / 2, y: wld.y - cy + mapH / 2 };
          };
          const allCoords = [smoothRouteFirstRef.current, ...coords.slice(1)];
          const segments = buildTrafficSegments(allCoords);
          segments.forEach((seg, i) => {
            const el = segRefs[i];
            if (!el) return;
            const points = seg.coords
              .map((c) => {
                const s = toScreenLocal(c.lat, c.lng);
                return `${s.x + PIN_HALF},${s.y + PIN_HALF}`;
              })
              .join(" ");
            el.setAttribute("points", points);
          });
        }

        imperativeUpdatePinsRef.current();

        if (t < 1) {
          routeRafRef.current = requestAnimationFrame(tick);
          return;
        }
      }
      routeRafRef.current = null;
    };
    routeRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    startRouteRaf();
  }, [techLat, techLng]);

  useEffect(() => {
    return () => {
      if (routeRafRef.current) cancelAnimationFrame(routeRafRef.current);
    };
  }, []);

  const containerRef = useRef<View>(null);
  const sizeRef = useRef({ w: 400, h: 400 });

  const techPinRef = useRef<View>(null);
  const fallbackLineRef = useRef<SVGLineElement | null>(null);
  const techLatLngRef = useRef({ lat: techLat, lng: techLng });
  const clientLatLngRef = useRef({ lat: clientLat, lng: clientLng });

  techLatLngRef.current = { lat: techLat, lng: techLng };
  clientLatLngRef.current = { lat: clientLat, lng: clientLng };

  imperativeUpdatePinsRef.current = () => {
    if (Platform.OS !== "web") return;
    const zoom = zoomRef.current;
    const cx = centerRef.current.x;
    const cy = centerRef.current.y;
    const { w: mapW, h: mapH } = sizeRef.current;
    const toScreenLocal = (lat: number, lng: number) => {
      const wld = geoToWorld(lat, lng, zoom);
      return { x: wld.x - cx + mapW / 2, y: wld.y - cy + mapH / 2 };
    };
    const PIN_HALF = 14;
    const techS = toScreenLocal(techLatLngRef.current.lat, techLatLngRef.current.lng);
    const clientS = toScreenLocal(clientLatLngRef.current.lat, clientLatLngRef.current.lng);
    if (techPinRef.current) {
      const el = techPinRef.current as unknown as HTMLElement;
      el.style.transition = "none";
      el.style.left = `${techS.x}px`;
      el.style.top = `${techS.y}px`;
    }
    if (fallbackLineRef.current) {
      fallbackLineRef.current.setAttribute("x1", String(techS.x + PIN_HALF));
      fallbackLineRef.current.setAttribute("y1", String(techS.y + PIN_HALF));
      fallbackLineRef.current.setAttribute("x2", String(clientS.x + PIN_HALF));
      fallbackLineRef.current.setAttribute("y2", String(clientS.y + PIN_HALF));
    }
  };

  const dragRef = useRef<{ startX: number; startY: number; startCx: number; startCy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; startZoom: number } | null>(null);
  const webInteractingRef = useRef(savedWeb != null);
  const webInteractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (savedWeb) {
      webInteractionTimerRef.current = setTimeout(() => {
        webInteractingRef.current = false;
      }, 5000);
    }
    return () => {
      if (webInteractionTimerRef.current) clearTimeout(webInteractionTimerRef.current);
    };
  }, []);

  const clampCenter = useCallback((cx: number, cy: number, zoom: number) => {
    const scale = TILE_SIZE * Math.pow(2, zoom);
    return { x: Math.max(0, Math.min(scale, cx)), y: Math.max(0, Math.min(scale, cy)) };
  }, []);

  const fitBothPins = useCallback(() => {
    const { w, h } = sizeRef.current;
    const fit = computeFit(techLat, techLng, clientLat, clientLng, w, h);
    zoomRef.current = fit.zoom;
    centerRef.current = clampCenter(fit.cx, fit.cy, fit.zoom);
    triggerRender();
  }, [techLat, techLng, clientLat, clientLng, clampCenter, triggerRender]);

  useEffect(() => {
    if (dragRef.current || pinchRef.current || webInteractingRef.current) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    const zoom = zoomRef.current;
    const cx = centerRef.current.x;
    const cy = centerRef.current.y;
    const MARGIN = 48;
    const isOffScreen = (lat: number, lng: number) => {
      const wld = geoToWorld(lat, lng, zoom);
      const sx = wld.x - cx + w / 2;
      const sy = wld.y - cy + h / 2;
      return sx < MARGIN || sx > w - MARGIN || sy < MARGIN || sy > h - MARGIN;
    };
    if (isOffScreen(techLat, techLng) || isOffScreen(clientLat, clientLng)) {
      fitBothPins();
    }
  }, [techLat, techLng, clientLat, clientLng, fitBothPins]);

  const applyZoom = useCallback((newZoom: number, pivotScreenX?: number, pivotScreenY?: number) => {
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    if (newZoom === zoomRef.current) return;
    const scale = Math.pow(2, newZoom - zoomRef.current);
    const { w, h } = sizeRef.current;
    const px = pivotScreenX ?? w / 2;
    const py = pivotScreenY ?? h / 2;
    const cx = centerRef.current.x;
    const cy = centerRef.current.y;
    const worldPivotX = cx + (px - w / 2);
    const worldPivotY = cy + (py - h / 2);
    const newCx = worldPivotX * scale - (px - w / 2);
    const newCy = worldPivotY * scale - (py - h / 2);
    zoomRef.current = newZoom;
    centerRef.current = clampCenter(newCx, newCy, newZoom);
    triggerRender();
  }, [clampCenter, triggerRender]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = (containerRef.current as unknown as HTMLElement);
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const rect = el.getBoundingClientRect();
      applyZoom(zoomRef.current + delta, e.clientX - rect.left, e.clientY - rect.top);
      webInteractingRef.current = true;
      if (webInteractionTimerRef.current) clearTimeout(webInteractionTimerRef.current);
      webInteractionTimerRef.current = setTimeout(() => { webInteractingRef.current = false; }, 5000);
    };

    const onMouseDown = (e: MouseEvent) => {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startCx: centerRef.current.x,
        startCy: centerRef.current.y,
      };
      el.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      centerRef.current = clampCenter(
        dragRef.current.startCx - dx,
        dragRef.current.startCy - dy,
        zoomRef.current,
      );
      triggerRender();
    };

    const onMouseUp = () => {
      if (dragRef.current) {
        webInteractingRef.current = true;
        if (webInteractionTimerRef.current) clearTimeout(webInteractionTimerRef.current);
        webInteractionTimerRef.current = setTimeout(() => { webInteractingRef.current = false; }, 5000);
      }
      dragRef.current = null;
      el.style.cursor = "grab";
    };

    const touchDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startCx: centerRef.current.x,
          startCy: centerRef.current.y,
        };
        pinchRef.current = null;
      } else if (e.touches.length === 2) {
        dragRef.current = null;
        pinchRef.current = { dist: touchDist(e.touches), startZoom: zoomRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragRef.current) {
        const dx = e.touches[0].clientX - dragRef.current.startX;
        const dy = e.touches[0].clientY - dragRef.current.startY;
        centerRef.current = clampCenter(
          dragRef.current.startCx - dx,
          dragRef.current.startCy - dy,
          zoomRef.current,
        );
        triggerRender();
      } else if (e.touches.length === 2 && pinchRef.current) {
        const newDist = touchDist(e.touches);
        const ratio = newDist / pinchRef.current.dist;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(pinchRef.current.startZoom + Math.log2(ratio))));
        if (newZoom !== zoomRef.current) {
          const rect = el.getBoundingClientRect();
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          applyZoom(newZoom, midX, midY);
        }
      }
    };

    const onTouchEnd = () => {
      if (dragRef.current || pinchRef.current) {
        webInteractingRef.current = true;
        if (webInteractionTimerRef.current) clearTimeout(webInteractionTimerRef.current);
        webInteractionTimerRef.current = setTimeout(() => { webInteractingRef.current = false; }, 5000);
      }
      dragRef.current = null;
      pinchRef.current = null;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.style.cursor = "grab";

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyZoom, clampCenter, triggerRender]);

  const zoom = zoomRef.current;
  const cx = centerRef.current.x;
  const cy = centerRef.current.y;
  const { w: mapW, h: mapH } = sizeRef.current;

  const centerTileX = Math.floor(cx / TILE_SIZE);
  const centerTileY = Math.floor(cy / TILE_SIZE);
  const RADIUS = 3;
  const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
  for (let ty = centerTileY - RADIUS; ty <= centerTileY + RADIUS; ty++) {
    for (let tx = centerTileX - RADIUS; tx <= centerTileX + RADIUS; tx++) {
      const left = tx * TILE_SIZE - cx + mapW / 2;
      const top = ty * TILE_SIZE - cy + mapH / 2;
      tiles.push({ key: `${zoom}-${tx}-${ty}`, url: buildTileUrl(zoom, tx, ty), left, top });
    }
  }

  const toScreen = (lat: number, lng: number) => {
    const w = geoToWorld(lat, lng, zoom);
    return { x: w.x - cx + mapW / 2, y: w.y - cy + mapH / 2 };
  };

  const techScreen = toScreen(techLat, techLng);
  const clientScreen = toScreen(clientLat, clientLng);
  const PIN_HALF = 14;

  const hasRoute = routeCoords.length > 1;
  const smoothedRouteCoords = hasRoute
    ? [smoothRouteFirstRef.current, ...routeCoords.slice(1)]
    : routeCoords;
  const trafficSegments = hasRoute ? buildTrafficSegments(smoothedRouteCoords) : [];
  segmentPolylineRefsRef.current.length = trafficSegments.length;

  return (
    <View
      ref={containerRef}
      style={[styles.webMapContainer, { backgroundColor: "#d4e4f0" }]}
      // @ts-ignore
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        sizeRef.current = { w: width, h: height };
        const currentSavedWeb = _savedWebMapState[order.id] ?? null;
        if (currentSavedWeb) {
          centerRef.current = clampCenter(currentSavedWeb.cx, currentSavedWeb.cy, currentSavedWeb.zoom);
          zoomRef.current = currentSavedWeb.zoom;
        } else {
          const fit = computeFit(techLat, techLng, clientLat, clientLng, width, height);
          zoomRef.current = fit.zoom;
          centerRef.current = { x: fit.cx, y: fit.cy };
        }
        triggerRender();
      }}
    >
      {tiles.map(({ key, url, left, top }) => (
        <Image
          key={key}
          source={{ uri: url }}
          style={{
            position: "absolute",
            left,
            top,
            width: TILE_SIZE,
            height: TILE_SIZE,
          }}
          resizeMode="cover"
        />
      ))}

      {Platform.OS === "web" && (
        // @ts-ignore
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        >
          {hasRoute ? (
            trafficSegments.map((seg, i) => {
              const pts = seg.coords
                .map((c) => {
                  const s = toScreen(c.lat, c.lng);
                  return `${s.x + PIN_HALF},${s.y + PIN_HALF}`;
                })
                .join(" ");
              return (
                // @ts-ignore
                <polyline
                  key={i}
                  ref={(el) => { segmentPolylineRefsRef.current[i] = el as SVGPolylineElement | null; }}
                  points={pts}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                />
              );
            })
          ) : (
            // @ts-ignore
            <line
              ref={(el) => { fallbackLineRef.current = el as SVGLineElement | null; }}
              x1={techScreen.x + PIN_HALF}
              y1={techScreen.y + PIN_HALF}
              x2={clientScreen.x + PIN_HALF}
              y2={clientScreen.y + PIN_HALF}
              stroke={ROUTE_COLOR}
              strokeWidth="2.5"
              strokeDasharray="8 4"
              strokeLinecap="round"
              opacity="0.8"
            />
          )}
        </svg>
      )}

      <View
        ref={techPinRef}
        style={[
          styles.pinMarker,
          { left: techScreen.x, top: techScreen.y, backgroundColor: TECH_PIN_COLOR },
          // @ts-ignore – CSS transition for web smooth animation (restored by React after imperative pan/zoom updates)
          { transition: "left 1s linear, top 1s linear" },
        ]}
        // @ts-ignore
        pointerEvents="none"
      >
        <VectorIcon name="tool" size={11} color="#FFF" />
      </View>

      <View
        style={[
          styles.pinMarker,
          { left: clientScreen.x, top: clientScreen.y, backgroundColor: CLIENT_PIN_COLOR },
        ]}
        // @ts-ignore
        pointerEvents="none"
      >
        <VectorIcon name="home" size={11} color="#FFF" />
      </View>

      <View style={[styles.zoomControls, { borderColor: colors.border }]} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.zoomBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => applyZoom(zoomRef.current + 1)}
          activeOpacity={0.75}
        >
          <VectorIcon name="plus" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.zoomDivider, { backgroundColor: colors.border }]} />
        <TouchableOpacity
          style={[styles.zoomBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => applyZoom(zoomRef.current - 1)}
          activeOpacity={0.75}
        >
          <VectorIcon name="minus" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.zoomDivider, { backgroundColor: colors.border }]} />
        <TouchableOpacity
          style={[styles.zoomBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={fitBothPins}
          activeOpacity={0.75}
        >
          <VectorIcon name="maximize-2" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.webOverlay, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        <View style={[styles.webOverlayRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <VectorIcon name="map-pin" size={16} color={TECH_PIN_COLOR} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
            {t("order.techLocation")}: {techLat.toFixed(4)}, {techLng.toFixed(4)}
          </Text>
        </View>
        <View style={[styles.webOverlayRow, { flexDirection: isRTL ? "row-reverse" : "row", marginTop: 6 }]}>
          <VectorIcon name="home" size={16} color={CLIENT_PIN_COLOR} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
            {t("order.yourLocation")}: {order.street}
          </Text>
        </View>
      </View>
    </View>
  );
}

type MapComponents = {
  MapView: React.ComponentType<import("react-native-maps").MapViewProps>;
  Marker: React.ComponentType<import("react-native-maps").MarkerProps>;
  Polyline: React.ComponentType<import("react-native-maps").PolylineProps>;
  UrlTile: React.ComponentType<import("react-native-maps").UrlTileProps>;
  Circle: React.ComponentType<import("react-native-maps").CircleProps>;
};

function NativeMapView({ order, techLat, techLng, clientLat, clientLng, routeCoords }: MapProps) {
  const [components, setComponents] = useState<MapComponents | null>(null);
  const mapRef = useRef<import("react-native-maps").default | null>(null);

  const animCoord = useRef(new Animated.ValueXY({ x: techLat, y: techLng })).current;
  const [displayCoord, setDisplayCoord] = useState({ latitude: techLat, longitude: techLng });

  const savedNative = _savedNativeRegion[order.id] ?? null;
  const userInteractingRef = useRef(savedNative != null);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFittingRef = useRef(false);
  const fittingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRegionRef = useRef<{ lat: number; lng: number; latDelta: number; lngDelta: number } | null>(
    savedNative
      ? {
          lat: savedNative.latitude,
          lng: savedNative.longitude,
          latDelta: savedNative.latitudeDelta,
          lngDelta: savedNative.longitudeDelta,
        }
      : null
  );

  useEffect(() => {
    const id = animCoord.addListener(({ x, y }) => {
      setDisplayCoord({ latitude: x, longitude: y });
    });
    return () => animCoord.removeListener(id);
  }, [animCoord]);

  useEffect(() => {
    Animated.timing(animCoord, {
      toValue: { x: techLat, y: techLng },
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [techLat, techLng, animCoord]);

  useEffect(() => {
    let cancelled = false;
    import("react-native-maps").then((mod) => {
      if (!cancelled) {
        setComponents({
          MapView: mod.default,
          Marker: mod.Marker,
          Polyline: mod.Polyline,
          UrlTile: mod.UrlTile,
          Circle: mod.Circle,
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fitPins = useCallback(() => {
    if (!mapRef.current) return;
    isFittingRef.current = true;
    if (fittingTimeoutRef.current) clearTimeout(fittingTimeoutRef.current);
    fittingTimeoutRef.current = setTimeout(() => {
      isFittingRef.current = false;
    }, 2500);
    mapRef.current.fitToCoordinates(
      [
        { latitude: techLat, longitude: techLng },
        { latitude: clientLat, longitude: clientLng },
      ],
      { edgePadding: { top: 80, right: 80, bottom: 80, left: 80 }, animated: true }
    );
  }, [techLat, techLng, clientLat, clientLng]);

  const handleRegionChange = useCallback(() => {
    if (isFittingRef.current) return;
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    userInteractingRef.current = true;
  }, []);

  const handleRegionChangeComplete = useCallback((region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => {
    visibleRegionRef.current = {
      lat: region.latitude,
      lng: region.longitude,
      latDelta: region.latitudeDelta,
      lngDelta: region.longitudeDelta,
    };
    _savedNativeRegion[order.id] = {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    };
    if (isFittingRef.current) {
      isFittingRef.current = false;
      return;
    }
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => {
      userInteractingRef.current = false;
    }, 8000);
  }, [order.id]);

  useEffect(() => {
    if (userInteractingRef.current) return;
    const region = visibleRegionRef.current;
    if (region) {
      const MARGIN = 0.8;
      const isInBounds = (lat: number, lng: number) =>
        Math.abs(lat - region.lat) < (region.latDelta / 2) * MARGIN &&
        Math.abs(lng - region.lng) < (region.lngDelta / 2) * MARGIN;
      if (isInBounds(techLat, techLng) && isInBounds(clientLat, clientLng)) return;
    }
    fitPins();
  }, [techLat, techLng, clientLat, clientLng, fitPins]);

  useEffect(() => {
    if (savedNative) {
      interactionTimerRef.current = setTimeout(() => {
        userInteractingRef.current = false;
      }, 8000);
    }
    return () => {
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
      if (fittingTimeoutRef.current) clearTimeout(fittingTimeoutRef.current);
    };
  }, []);

  if (!components) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const { MapView, Marker, Polyline, UrlTile, Circle } = components;

  const hasRoute = routeCoords.length > 1;
  const routeCoordinates = hasRoute
    ? [
        { latitude: displayCoord.latitude, longitude: displayCoord.longitude },
        ...routeCoords.slice(1).map((c) => ({ latitude: c.lat, longitude: c.lng })),
      ]
    : [
        { latitude: displayCoord.latitude, longitude: displayCoord.longitude },
        { latitude: clientLat, longitude: clientLng },
      ];
  const nativeTrafficSegments = hasRoute
    ? buildTrafficSegments(
        routeCoordinates.map((c) => ({ lat: c.latitude, lng: c.longitude }))
      )
    : null;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        // @ts-ignore – ref forwarding on dynamic import; works at runtime
        ref={mapRef}
        style={styles.map}
        initialRegion={savedNative ?? {
          latitude: ALEX.lat,
          longitude: ALEX.lng,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        mapType="none"
        showsUserLocation={false}
        showsMyLocationButton={false}
        onMapReady={savedNative ? undefined : fitPins}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        <UrlTile
          urlTemplate={OSM_TILE_URL}
          maximumZ={19}
          flipY={false}
        />
        {nativeTrafficSegments ? (
          nativeTrafficSegments.map((seg, i) => (
            <Polyline
              key={i}
              coordinates={seg.coords.map((c) => ({ latitude: c.lat, longitude: c.lng }))}
              strokeColor={seg.color}
              strokeWidth={4}
            />
          ))
        ) : (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={ROUTE_COLOR}
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}
        <Marker
          coordinate={displayCoord}
          title={order.technicianName ?? ""}
          pinColor={TECH_PIN_COLOR}
        />
        <Marker
          coordinate={{ latitude: clientLat, longitude: clientLng }}
          title={order.street}
          pinColor={CLIENT_PIN_COLOR}
        />
        <Circle
          center={{ latitude: clientLat, longitude: clientLng }}
          radius={120}
          strokeColor="rgba(229,57,53,0.5)"
          fillColor="rgba(229,57,53,0.12)"
        />
      </MapView>
      <TouchableOpacity
        style={styles.nativeFitBtn}
        onPress={fitPins}
        activeOpacity={0.75}
      >
        <VectorIcon name="maximize-2" size={18} color="#1565C0" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  map: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  webMapContainer: { flex: 1, position: "relative", overflow: "hidden" },
  pinMarker: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoomControls: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -44,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
    borderWidth: 1,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomDivider: {
    height: 1,
  },
  webOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 64,
    padding: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  webOverlayRow: { alignItems: "center" },
  nativeFitBtn: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  infoCard: {
    paddingTop: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  legendRow: {
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLegendLine: {
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  etaBanner: {
    padding: 10,
    alignItems: "center",
    marginBottom: 12,
    gap: 4,
  },
  etaDivider: {
    width: 1,
    height: 14,
    opacity: 0.4,
    marginHorizontal: 6,
  },
  techRow: {
    alignItems: "center",
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  techAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ratingChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  callBtnText: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  confirmArrivalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  confirmArrivalText: {
    color: "#FFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  actionRow: {
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  trafficBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trafficBadgeText: {
    color: "#FFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
});
