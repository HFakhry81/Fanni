import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  type DimensionValue,
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

function interpolate(a: number, b: number, progress: number): number {
  return a + (b - a) * progress;
}

interface MapProps {
  order: Order;
  techLat: number;
  techLng: number;
  clientLat: number;
  clientLng: number;
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

  const [techLat, setTechLat] = useState(clientLat - TECH_START_OFFSET);
  const [techLng, setTechLng] = useState(clientLng - TECH_START_OFFSET);
  const progressRef = useRef(0);

  useEffect(() => {
    if (!order) return;
    const interval = setInterval(() => {
      progressRef.current = Math.min(progressRef.current + 0.005, 0.95);
      const p = progressRef.current;
      setTechLat(interpolate(clientLat - TECH_START_OFFSET, clientLat - 0.0005, p));
      setTechLng(interpolate(clientLng - TECH_START_OFFSET, clientLng - 0.0005, p));
    }, 1000);
    return () => clearInterval(interval);
  }, [order, clientLat, clientLng]);

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>{t("common.noData")}</Text>
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const mapProps: MapProps = { order, techLat, techLng, clientLat, clientLng };

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
      </View>
    </View>
  );
}

const TECH_PIN_COLOR = "#1565C0";
const CLIENT_PIN_COLOR = "#E53935";
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

interface WebMapViewProps extends MapProps {
  colors: AppColors;
  t: (key: string) => string;
  isRTL: boolean;
}

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const radLat = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(radLat) + 1 / Math.cos(radLat)) / Math.PI) / 2) * Math.pow(2, zoom),
  );
}

function buildTileUrl(z: number, x: number, y: number): string {
  return OSM_TILE_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

function techProgress(techLat: number, techLng: number, clientLat: number, clientLng: number): number {
  const startLat = clientLat - TECH_START_OFFSET;
  const startLng = clientLng - TECH_START_OFFSET;
  const totalDist = Math.sqrt(Math.pow(clientLat - startLat, 2) + Math.pow(clientLng - startLng, 2));
  const remainDist = Math.sqrt(Math.pow(clientLat - techLat, 2) + Math.pow(clientLng - techLng, 2));
  return totalDist > 0 ? 1 - remainDist / totalDist : 1;
}

function WebMapView({ order, techLat, techLng, clientLat, clientLng, colors, t, isRTL }: WebMapViewProps) {
  const zoom = 14;
  const tx = lngToTileX(ALEX.lng, zoom);
  const ty = latToTileY(ALEX.lat, zoom);

  const progress = techProgress(techLat, techLng, clientLat, clientLng);
  const techLeftPct = Math.max(8, Math.min(75, Math.round((1 - progress) * 70)));

  const tileRows: string[][] = [
    [buildTileUrl(zoom, tx - 1, ty - 1), buildTileUrl(zoom, tx, ty - 1), buildTileUrl(zoom, tx + 1, ty - 1)],
    [buildTileUrl(zoom, tx - 1, ty),     buildTileUrl(zoom, tx, ty),     buildTileUrl(zoom, tx + 1, ty)],
    [buildTileUrl(zoom, tx - 1, ty + 1), buildTileUrl(zoom, tx, ty + 1), buildTileUrl(zoom, tx + 1, ty + 1)],
  ];

  return (
    <View style={[styles.webMapContainer, { backgroundColor: "#d4e4f0" }]}>
      <View style={[styles.tilesGrid, { pointerEvents: "none" }]}>
        {tileRows.map((row, ri) => (
          <View key={ri} style={styles.tilesRow}>
            {row.map((url, ci) => (
              <Image key={ci} source={{ uri: url }} style={styles.tile} resizeMode="cover" />
            ))}
          </View>
        ))}
      </View>
      <View style={[styles.pinsOverlay, { pointerEvents: "none" }]}>
        <View style={[styles.pinMarker, { left: `${techLeftPct}%` as DimensionValue, top: "35%" as DimensionValue, backgroundColor: TECH_PIN_COLOR }]}>
          <Feather name="tool" size={11} color="#FFF" />
        </View>
        <View style={[styles.pinMarker, { right: "15%" as DimensionValue, top: "55%" as DimensionValue, backgroundColor: CLIENT_PIN_COLOR }]}>
          <Feather name="home" size={11} color="#FFF" />
        </View>
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
  UrlTile: React.ComponentType<import("react-native-maps").UrlTileProps>;
  Circle: React.ComponentType<import("react-native-maps").CircleProps>;
};

function NativeMapView({ order, techLat, techLng, clientLat, clientLng }: MapProps) {
  const [components, setComponents] = useState<MapComponents | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("react-native-maps").then((mod) => {
      if (!cancelled) {
        setComponents({
          MapView: mod.default,
          Marker: mod.Marker,
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

  const { MapView, Marker, UrlTile, Circle } = components;

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
  tilesGrid: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  tilesRow: { flex: 1, flexDirection: "row" },
  tile: { flex: 1 },
  pinsOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
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
  webOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
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
  legendRow: { alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  techRow: {
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 0,
  },
  techAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingChip: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 10 },
});
