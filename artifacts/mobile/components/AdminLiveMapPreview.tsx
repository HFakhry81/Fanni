import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import OsmMultiMap, { type OsmMarker } from "@/components/OsmMultiMap";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { getApiBase } from "@/utils/api";
import { specialtyColor } from "@/utils/adminMapColors";

interface MapOrder {
  id: string;
  orderNumber: string;
  status: string;
  latitude: number;
  longitude: number;
}

interface MapTech {
  id: string;
  name: string;
  profession: string | null;
  specialty: string | null;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
}

type Props = {
  sessionToken: string | null;
  isRTL: boolean;
  compact?: boolean;
  mode?: "live" | "tech";
  refreshMs?: number;
  onExpand?: () => void;
};

export default function AdminLiveMapPreview({
  sessionToken,
  isRTL,
  compact = false,
  mode = "live",
  refreshMs = 30_000,
  onExpand,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const [orders, setOrders] = useState<MapOrder[]>([]);
  const [techs, setTechs] = useState<MapTech[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMapData = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const base = getApiBase();
      if (!base) return;
      const params = new URLSearchParams({
        ...(mode === "tech" ? { availableOnly: "true", includeOrders: "false" } : {}),
      });
      const res = await fetch(`${base}/api/admin/map-data?${params}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json() as { orders?: MapOrder[]; techs?: MapTech[] };
        setOrders(data.orders ?? []);
        setTechs(data.techs ?? []);
      }
    } catch {
      // silent for preview widget
    } finally {
      setLoading(false);
    }
  }, [sessionToken, mode]);

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, refreshMs);
    return () => clearInterval(interval);
  }, [fetchMapData, refreshMs]);

  const markers: OsmMarker[] = useMemo(() => {
    const orderMarkers: OsmMarker[] =
      mode === "tech"
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
        mode === "tech"
          ? specialtyColor(tech.specialty ?? tech.profession)
          : tech.isAvailable
            ? "#10B981"
            : "#9CA3AF",
      label: "T",
    }));
    return [...orderMarkers, ...techMarkers];
  }, [orders, techs, mode]);

  const openFullMap = () => {
    if (onExpand) {
      onExpand();
      return;
    }
    router.push({
      pathname: "/(admin)/(tabs)/map-dashboard",
      params: { mode: mode === "tech" ? "tech" : "live" },
    });
  };

  if (Platform.OS === "web") {
    return (
      <TouchableOpacity
        style={[styles.webFallback, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={openFullMap}
      >
        <VectorIcon name="map" size={22} color={colors.primary} />
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 8 }}>
          {isRTL ? "افتح الخريطة في التطبيق" : "Open map in mobile app"}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 15, flex: 1, textAlign: isRTL ? "right" : "left" }}>
          {mode === "tech"
            ? (isRTL ? "خريطة الفنيين المتاحين" : "Available Technicians Map")
            : (isRTL ? "خريطة الفنيين والطلبات" : "Live Tech & Order Map")}
        </Text>
        <TouchableOpacity onPress={openFullMap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <VectorIcon name="maximize-2" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.mapBox, compact && styles.mapBoxCompact]}>
        {loading && markers.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <OsmMultiMap
            style={StyleSheet.absoluteFill}
            markers={markers}
            fitMarkers
            initialCenter={{ latitude: 31.2001, longitude: 29.9187 }}
            initialZoom={11}
          />
        )}
      </View>

      <View style={[styles.legend, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {mode === "tech" ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
            {isRTL ? "ألوان حسب التخصص" : "Colors by specialty"}
          </Text>
        ) : (
          <>
            <LegendDot color="#F59E0B" label={isRTL ? "طلب" : "Order"} />
            <LegendDot color="#10B981" label={isRTL ? "فني متاح" : "Available"} />
            <LegendDot color="#9CA3AF" label={isRTL ? "غير متاح" : "Busy"} />
          </>
        )}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1.5, borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  header: { paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" },
  mapBox: { height: 220, backgroundColor: "#EEF3FA" },
  mapBoxCompact: { height: 180 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  legend: { paddingHorizontal: 14, paddingVertical: 8, flexWrap: "wrap", gap: 4 },
  webFallback: { borderWidth: 1.5, borderRadius: 14, padding: 24, alignItems: "center", marginBottom: 16 },
});
