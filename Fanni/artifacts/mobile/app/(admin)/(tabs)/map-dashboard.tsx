// app/(admin)/map-dashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import MapView, { Marker, Circle, Callout, PROVIDER_DEFAULT } from "react-native-maps";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import VectorIcon from "@/components/VectorIcon";
import AppHeader from "@/components/AppHeader";

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
  const [selectedOrderCoords, setSelectedOrderCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const fetchMapData = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const domain = process.env["EXPO_PUBLIC_DOMAIN"] ?? "";
      const res = await fetch(`http://${domain}/api/admin/map-data`, {
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
    // تحديث تلقائي كل 30 ثانية لمتابعة حركة الفنيين حياً
    const interval = setInterval(fetchMapData, 30000);
    return () => clearInterval(interval);
  }, [fetchMapData]);

  // الإسكندرية كموقع مركزي افتراضي للخريطة
  const initialRegion = {
    latitude: 31.2001,
    longitude: 29.9187,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader 
        title={isRTL ? "خريطة المراقبة الحية" : "Live Monitor Map"} 
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
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={initialRegion}
          >
            {/* 1. مؤشرات الطلبات النشطة */}
            {orders.map((order) => {
              const isSelected = selectedOrderId === order.id;
              const markerColor = order.status === "in_progress" ? "#3B82F6" : "#F59E0B"; // أزرق للتنفيذ، أصفر للمعلق
              
              return (
                <Marker
                  key={`order-${order.id}`}
                  coordinate={{ latitude: order.latitude, longitude: order.longitude }}
                  onPress={() => {
                    setSelectedOrderId(order.id);
                    setSelectedOrderCoords({ latitude: order.latitude, longitude: order.longitude });
                  }}
                >
                  <View style={[styles.markerPin, { backgroundColor: markerColor, borderColor: "#FFF" }]}>
                    <VectorIcon name="clipboard" size={12} color="#FFF" />
                  </View>

                  <Callout tooltip>
                    <View style={[styles.calloutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.calloutTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                        {order.orderNumber}
                      </Text>
                      <Text style={[styles.calloutSub, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
                        {t(`cat.${order.category}`) || order.category} - {order.subCategory}
                      </Text>
                      <Text style={[styles.calloutClient, { color: colors.primary, textAlign: isRTL ? "right" : "left" }]}>
                        {isRTL ? "العميل:" : "Client:"} {order.clientName}
                      </Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}

            {/* 2. مؤشرات الفنيين */}
            {techs.map((tech) => (
              <Marker
                key={`tech-${tech.id}`}
                coordinate={{ latitude: tech.latitude, longitude: tech.longitude }}
              >
                <View style={[styles.markerPin, { backgroundColor: tech.isAvailable ? "#10B981" : "#9CA3AF", borderColor: "#FFF" }]}>
                  <VectorIcon name="tool" size={12} color="#FFF" />
                </View>

                <Callout tooltip>
                  <View style={[styles.calloutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.calloutTitle, { color: colors.foreground }]}>{tech.name}</Text>
                    <Text style={[styles.calloutSub, { color: colors.mutedForeground }]}>{tech.profession}</Text>
                    <Text style={{ fontSize: 11, color: tech.isAvailable ? "#10B981" : "#9CA3AF", marginTop: 4 }}>
                      {tech.isAvailable ? (isRTL ? "متاح للعمل" : "Available") : (isRTL ? "غير نشط" : "Offline")}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            ))}

            {/* 3. دائرة النطاق الجغرافي عند اختيار طلب معين لمعرفة الفنيين القريبين منه */}
            {selectedOrderCoords && (
              <Circle
                center={selectedOrderCoords}
                radius={5000} // نصف قطر 5 كم لمطابقة الفنيين القريبين
                strokeWidth={2}
                strokeColor="rgba(59, 130, 246, 0.5)"
                fillColor="rgba(59, 130, 246, 0.1)"
              />
            )}
          </MapView>

          {/* لوحة تحكم سفلية عائمة لمسح التحديد الجغرافي النشط */}
          {selectedOrderId && (
            <TouchableOpacity 
              style={[styles.floatingBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => { setSelectedOrderId(null); setSelectedOrderCoords(null); }}
            >
              <VectorIcon name="x" size={14} color={colors.destructive} />
              <Text style={{ color: colors.foreground, marginLeft: 6, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                {isRTL ? "إلغاء تحديد نطاق الطلب" : "Clear selected order filter"}
              </Text>
            </TouchableOpacity>
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
  mapContainer: { flex: 1, position: "relative" },
  map: { width: Dimensions.get("window").width, height: "100%" },
  markerPin: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, justifyContent: "center", alignItems: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.2 },
  calloutCard: { padding: 10, borderRadius: 8, borderWidth: 1, minWidth: 150 },
  calloutTitle: { fontFamily: "Inter_700Bold", fontSize: 13 },
  calloutSub: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  calloutClient: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginTop: 4 },
  floatingBanner: { position: "absolute", bottom: 20, alignSelf: "center", flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, elevation: 5 }
});