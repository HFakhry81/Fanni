// app/(admin)/map-dashboard.tsx — OSM (no Google Maps API key)
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import VectorIcon from "@/components/VectorIcon";
import AppHeader from "@/components/AppHeader";
import OsmMultiMap, { type OsmMarker } from "@/components/OsmMultiMap";
import { getApiBase } from "@/utils/api";

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
  latitude: number;
  longitude: number;
  isAvailable: boolean;
}

export default function AdminMapDashboard() {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const { sessionToken } = useAuth();

  const [orders, setOrders] = useState<MapOrder[]>([]);
  const [techs, setTechs] = useState<MapTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderCoords, setSelectedOrderCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const fetchMapData = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const base = getApiBase();
      if (!base) return;
      const res = await fetch(`${base}/api/admin/map-data`, {
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
  }, [sessionToken]);

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 30000);
    return () => clearInterval(interval);
  }, [fetchMapData]);

  const markers: OsmMarker[] = useMemo(() => {
    const orderMarkers: OsmMarker[] = orders.map((order) => ({
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
      color: tech.isAvailable ? "#10B981" : "#9CA3AF",
      label: "T",
    }));
    return [...orderMarkers, ...techMarkers];
  }, [orders, techs]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const selectedTech =
    selectedOrderId?.startsWith("tech-")
      ? techs.find((t) => `tech-${t.id}` === selectedOrderId)
      : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={isRTL ? "خريطة المراقبة الحية" : "Live Monitor Map"}
        showBack
        homeHref="/(admin)/(tabs)/dashboard"
        rightElement={
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchMapData}>
            <VectorIcon name="refresh-cw" size={18} color={colors.foreground} />
          </TouchableOpacity>
        }
      />

      {loading && orders.length === 0 ? (
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
                  <Text style={[styles.calloutSub, { color: colors.mutedForeground }]}>{selectedTech.profession}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  refreshBtn: { padding: 8 },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  infoCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 6,
    shadowColor: "#0D1B2A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  calloutTitle: { fontFamily: "Inter_700Bold", fontSize: 13 },
  calloutSub: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  calloutClient: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginTop: 4 },
  clearRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    alignSelf: "flex-start",
  },
});
