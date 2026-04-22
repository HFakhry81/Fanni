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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors, type AppColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useOrders, Order } from "@/context/OrderContext";
import { GOV_COORDINATES } from "@/constants/egyptLocations";

const ALEX = GOV_COORDINATES.alexandria;
const TECH_START_OFFSET = 0.018;

interface RouteData {
  coords: Array<{ lat: number; lng: number }>;
  durationSec: number;
}

async function fetchOSRMRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteData | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const coords = (route.geometry.coordinates as [number, number][]).map(
      ([lng, lat]) => ({ lat, lng })
    );
    return { coords, durationSec: route.duration };
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

function computeEtaFallback(
  techLat: number,
  techLng: number,
  clientLat: number,
  clientLng: number
): number {
  const latDiff = clientLat - techLat;
  const lngDiff = clientLng - techLng;
  const distDeg = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  const distKm = distDeg * 111;
  const speedKmH = 20;
  const minutes = (distKm / speedKmH) * 60;
  return Math.max(1, Math.round(minutes));
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
  const { orders } = useOrders();
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

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    fetchOSRMRoute(techStartLat, techStartLng, clientLat, clientLng).then((data) => {
      if (!cancelled) setRouteData(data);
    });
    return () => { cancelled = true; };
  }, [order, techStartLat, techStartLng, clientLat, clientLng]);

  useEffect(() => {
    if (!order) return;
    const interval = setInterval(() => {
      progressRef.current = Math.min(progressRef.current + 0.005, 0.95);
      const p = progressRef.current;

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
    return () => clearInterval(interval);
  }, [order, clientLat, clientLng, techStartLat, techStartLng, routeData]);

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>{t("common.noData")}</Text>
      </View>
    );
  }

  let eta: number;
  if (routeData) {
    const remaining = routeData.durationSec * (1 - progressRef.current);
    eta = Math.max(1, Math.round(remaining / 60));
  } else {
    eta = computeEtaFallback(techLat, techLng, clientLat, clientLng);
  }

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const routeCoords = routeData
    ? getRemainingRoute(routeData.coords, progressRef.current, techLat, techLng)
    : [];
  const mapProps: MapProps = { order, techLat, techLng, clientLat, clientLng, routeCoords };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.muted, borderRadius: 10 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {t("order.trackMap")}
        </Text>
        <View style={{ width: 36 }} />
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
            <View style={[styles.routeLegendLine, { backgroundColor: ROUTE_COLOR }]} />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {t("order.routeLine")}
            </Text>
          </View>
        </View>

        <View style={[styles.etaBanner, { backgroundColor: colors.accent, borderRadius: colors.radius, flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Feather name="clock" size={15} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
            {t("order.arrivingIn")}{eta} {t("order.minutes")}
          </Text>
        </View>

        {order.technicianName && (
          <View style={[styles.techRow, { flexDirection: isRTL ? "row-reverse" : "row", borderTopColor: colors.border }]}>
            <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
              <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 14 }}>{order.technicianName[0]}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: isRTL ? "right" : "left" }}>
                {order.technicianName}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: isRTL ? "right" : "left" }}>
                {t("order.onTheWay")}
              </Text>
            </View>
            {order.technicianRating && (
              <View style={[styles.ratingChip, { backgroundColor: colors.accent, borderRadius: 8 }]}>
                <Feather name="star" size={12} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12, marginLeft: 4 }}>
                  {order.technicianRating}
                </Text>
              </View>
            )}
          </View>
        )}

        {order.technicianMobile && (
          <TouchableOpacity
            style={[styles.callBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            onPress={() => Linking.openURL(`tel:${order.technicianMobile}`)}
            activeOpacity={0.8}
          >
            <Feather name="phone" size={16} color="#FFF" />
            <Text style={[styles.callBtnText, { marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}>
              {t("order.callTech")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const TECH_PIN_COLOR = "#1565C0";
const CLIENT_PIN_COLOR = "#E53935";
const ROUTE_COLOR = "#1565C0";
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
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

function WebMapView({ order, techLat, techLng, clientLat, clientLng, routeCoords, colors, t, isRTL }: WebMapViewProps) {
  const midLat = (techLat + clientLat) / 2;
  const midLng = (techLng + clientLng) / 2;

  const zoomRef = useRef(INITIAL_ZOOM);
  const centerRef = useRef(geoToWorld(midLat, midLng, INITIAL_ZOOM));
  const [, setRenderTick] = useState(0);
  const triggerRender = useCallback(() => setRenderTick((n) => n + 1), []);

  const containerRef = useRef<View>(null);
  const sizeRef = useRef({ w: 400, h: 400 });

  const dragRef = useRef<{ startX: number; startY: number; startCx: number; startCy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; startZoom: number } | null>(null);

  const clampCenter = useCallback((cx: number, cy: number, zoom: number) => {
    const scale = TILE_SIZE * Math.pow(2, zoom);
    return { x: Math.max(0, Math.min(scale, cx)), y: Math.max(0, Math.min(scale, cy)) };
  }, []);

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
  const routePoints = hasRoute
    ? routeCoords
        .map((c) => {
          const s = toScreen(c.lat, c.lng);
          return `${s.x + PIN_HALF},${s.y + PIN_HALF}`;
        })
        .join(" ")
    : null;

  return (
    <View
      ref={containerRef}
      style={[styles.webMapContainer, { backgroundColor: "#d4e4f0" }]}
      // @ts-ignore
      onLayout={(e) => {
        sizeRef.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
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
            // @ts-ignore
            <polyline
              points={routePoints!}
              fill="none"
              stroke={ROUTE_COLOR}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          ) : (
            // @ts-ignore
            <line
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
        style={[
          styles.pinMarker,
          { left: techScreen.x, top: techScreen.y, backgroundColor: TECH_PIN_COLOR },
        ]}
        // @ts-ignore
        pointerEvents="none"
      >
        <Feather name="tool" size={11} color="#FFF" />
      </View>

      <View
        style={[
          styles.pinMarker,
          { left: clientScreen.x, top: clientScreen.y, backgroundColor: CLIENT_PIN_COLOR },
        ]}
        // @ts-ignore
        pointerEvents="none"
      >
        <Feather name="home" size={11} color="#FFF" />
      </View>

      <View style={[styles.zoomControls, { borderColor: colors.border }]} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.zoomBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => applyZoom(zoomRef.current + 1)}
          activeOpacity={0.75}
        >
          <Feather name="plus" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.zoomDivider, { backgroundColor: colors.border }]} />
        <TouchableOpacity
          style={[styles.zoomBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => applyZoom(zoomRef.current - 1)}
          activeOpacity={0.75}
        >
          <Feather name="minus" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.webOverlay, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
        <View style={[styles.webOverlayRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Feather name="map-pin" size={16} color={TECH_PIN_COLOR} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
            {t("order.techLocation")}: {techLat.toFixed(4)}, {techLng.toFixed(4)}
          </Text>
        </View>
        <View style={[styles.webOverlayRow, { flexDirection: isRTL ? "row-reverse" : "row", marginTop: 6 }]}>
          <Feather name="home" size={16} color={CLIENT_PIN_COLOR} />
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
    ? routeCoords.map((c) => ({ latitude: c.lat, longitude: c.lng }))
    : [
        { latitude: techLat, longitude: techLng },
        { latitude: clientLat, longitude: clientLng },
      ];

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: ALEX.lat,
        longitude: ALEX.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }}
      mapType="none"
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      <UrlTile
        urlTemplate={OSM_TILE_URL}
        maximumZ={19}
        flipY={false}
      />
      <Polyline
        coordinates={routeCoordinates}
        strokeColor={ROUTE_COLOR}
        strokeWidth={3}
        lineDashPattern={hasRoute ? undefined : [8, 5]}
      />
      <Marker
        coordinate={{ latitude: techLat, longitude: techLng }}
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
});
