// app/(admin)/map-dashboard.tsx — OSM (no Google Maps API key)
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import VectorIcon from "@/components/VectorIcon";
import AppHeader from "@/components/AppHeader";
import OsmMultiMap, { type OsmMarker } from "@/components/OsmMultiMap";
import { getApiBase } from "@/utils/api";
import { specialtyColor } from "@/utils/adminMapColors";

interface MapOrder {
  id: string;
  orderNumber: string;
  category: string;
  subCategory: string;
  status: string;
  latitude: number;
  longitude: number;
  clientName: string;
}

interface MapTech {
  id: string;
  name: string;
  profession: string;
  specialty: string | null;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
}

type MapMode = "live" | "monitor" | "tech";

function parseMode(raw: string | string[] | undefined): MapMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "tech" || value === "monitor") return value;
  return "live";
}

export default function AdminMapDashboard() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mapMode = parseMode(modeParam);

  const [orders, setOrders] = useState<MapOrder[]>([]);
  const [techs, setTechs] = useState<MapTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderCoords, setSelectedOrderCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const refreshMs = mapMode === "monitor" ? 30 * 60 * 1000 : 30 * 1000;

  const fetchMapData = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const base = getApiBase();
      if (!base) return;
      const params = new URLSearchParams({
        ...(mapMode === "tech" ? { availableOnly: "true", includeOrders: "false" } : {}),
      });
      const res = await fetch(`${base}/api/admin/map-data?${params}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
        setTechs(data.techs ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch admin map data", err);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, mapMode]);

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, refreshMs);
    return () => clearInterval(interval);
  }, [fetchMapData, refreshMs]);

  const markers: OsmMarker[] = useMemo(() => {
    const orderMarkers: OsmMarker[] =
      mapMode === "tech"
        ? []
        : orders.map((order) => ({
            id: `order-${order.id}`,
            latitude: order.latitude,
            longitude: order.longitude,
            color: order.status === "in_progress" ? "#3B82F6" : "#F59E0B",
            label: "O",
          }));
    const techMarkers: OsmMarker[] = techs.map((tech) => ({
      id: `tech-${tech.id}`,
      latitude: tech.latitude,
      longitude: tech.longitude,
      color:
        mapMode === "tech"
          ? specialtyColor(tech.specialty ?? tech.profession)
          : tech.isAvailable
            ? "#10B981"
            : "#9CA3AF",
      label: "T",
    }));
    return [...orderMarkers, ...techMarkers];
  }, [orders, techs, mapMode]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const selectedTech =
    selectedOrderId?.startsWith("tech-")
      ? techs.find((tech) => `tech-${tech.id}` === selectedOrderId)
      : null;

  const title =
    mapMode === "tech"
      ? (isRTL ? "خريطة الفنيين المتاحين" : "Available Technicians Map")
      : mapMode === "monitor"
        ? (isRTL ? "خريطة المراقبة" : "Monitoring Map")
        : (isRTL ? "خريطة المراقبة الحية" : "Live Monitor Map");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={title}
        showBack
        homeHref="/(admin)/(tabs)/dashboard"
        rightElement={
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchMapData}>
            <VectorIcon name="refresh-cw" size={18} color={colors.foreground} />
          </TouchableOpacity>
        }
      />

      {loading && orders.length === 0 && techs.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.mapContainer}>
          <OsmMultiMap
            style={styles.map}
            markers={markers}
            fitMarkers
            initialCenter={{ latitude: 31.2001, longitude: 29.9187 }}
            initialZoom={12}
            circles={
              selectedOrderCoords
                ? [
                    {
                      latitude: selectedOrderCoords.latitude,
                      longitude: selectedOrderCoords.longitude,
                      radiusM: 5000,
                      color: "#3B82F6",
                    },
                  ]
                : []
            }
            onMarkerPress={(id) => {
              if (id.startsWith("order-")) {
                const orderId = id.replace("order-", "");
                const order = orders.find((o) => o.id === orderId);
                if (!order) return;
                setSelectedOrderId(orderId);
                setSelectedOrderCoords({
                  latitude: order.latitude,
                  longitude: order.longitude,
                });
              } else if (id.startsWith("tech-")) {
                setSelectedOrderId(id);
                setSelectedOrderCoords(null);
              }
            }}
          />

          <View style={[styles.legendBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {mapMode === "tech" ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                {isRTL ? "ألوان حسب التخصص · فنيون متاحون فقط" : "Colors by specialty · available techs only"}
              </Text>
            ) : (
              <>
                <LegendDot color="#F59E0B" label={isRTL ? "طلب" : "Order"} />
                <LegendDot color="#3B82F6" label={isRTL ? "قيد التنفيذ" : "In progress"} />
                <LegendDot color="#10B981" label={isRTL ? "فني متاح" : "Available"} />
              </>
            )}
          </View>

          {(selectedOrder || selectedTech) && (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {selectedOrder ? (
                <>
                  <Text style={[styles.calloutTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {selectedOrder.orderNumber}
                  </Text>
                  <Text style={[styles.calloutSub, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                    {t(`cat.${selectedOrder.category}`) || selectedOrder.category} - {selectedOrder.subCategory}
                  </Text>
                  <Text style={[styles.calloutClient, { color: colors.primary, textAlign: isRTL ? "right" : "left" }]}>
                    {isRTL ? "العميل:" : "Client:"} {selectedOrder.clientName}
                  </Text>
                </>
              ) : selectedTech ? (
                <>
                  <Text style={[styles.calloutTitle, { color: colors.foreground }]}>{selectedTech.name}</Text>
                  <Text style={[styles.calloutSub, { color: colors.mutedForeground }]}>
                    {selectedTech.specialty ?? selectedTech.profession}
                  </Text>
                </>
              ) : null}
              <TouchableOpacity
                style={styles.clearRow}
                onPress={() => {
                  setSelectedOrderId(null);
                  setSelectedOrderCoords(null);
                }}
              >
                <VectorIcon name="x" size={14} color={colors.destructive} />
                <Text style={{ color: colors.foreground, marginLeft: 6, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                  {isRTL ? "إلغاء التحديد" : "Clear selection"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 12 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  refreshBtn: { padding: 8 },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  legendBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoCard: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  calloutTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  calloutSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 },
  calloutClient: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 6 },
  clearRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
});
