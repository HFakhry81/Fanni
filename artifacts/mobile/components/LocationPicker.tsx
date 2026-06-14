// artifacts/mobile/components/LocationPicker.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import MapPickerModal from "./MapPickerModal";

export interface LocationPickerProps {
  governorateId: string;
  areaId: string;
  onGovernorateChange: (id: string) => void;
  onAreaChange: (id: string) => void;
  onGovernorateSelect?: (opt: { ar: string; en: string }) => void;
  onAreaSelect?: (opt: { ar: string; en: string }) => void;
  street: string;
  onStreetChange: (v: string) => void;
  building?: string;
  onBuildingChange?: (v: string) => void;
  floor?: string;
  onFloorChange?: (v: string) => void;
  apartment?: string;
  onApartmentChange?: (v: string) => void;
  latitude: number | null;
  longitude: number | null;
  onCoordsChange: (lat: number | null, lng: number | null) => void;
  showDetails?: boolean;
}

export default function LocationPicker({
  governorateId, areaId, onGovernorateChange, onAreaChange, onGovernorateSelect, onAreaSelect,
  street, onStreetChange, building = "", onBuildingChange, floor = "", onFloorChange, apartment = "", onApartmentChange,
  latitude, longitude, onCoordsChange, showDetails = true
}: LocationPickerProps) {
  const colors = useColors();
  const { t, isRTL } = useApp();
  const [mapVisible, setMapVisible] = useState(false);
  const [showAutoFillBanner, setShowAutoFillBanner] = useState(false);

  const handleMapConfirm = (data: {
    latitude: number;
    longitude: number;
    street?: string;
  }) => {
    onCoordsChange(data.latitude, data.longitude);
    if (data.street) {
      onStreetChange(data.street);
      setShowAutoFillBanner(true);
      setTimeout(() => setShowAutoFillBanner(false), 3000);
    }
    setMapVisible(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.mapBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]} 
        onPress={() => setMapVisible(true)}
      >
        <VectorIcon name="map" size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", marginLeft: 6 }}>
          {latitude && longitude ? "تم تحديد الموقع" : "تحديد على الخريطة"}
        </Text>
      </TouchableOpacity>

      {showAutoFillBanner && (
        <View style={[styles.banner, { backgroundColor: "#ECFDF5", borderColor: "#10B981" }]}>
          <Text style={{ color: "#065F46", fontSize: 12, fontFamily: "Inter_500Medium" }}>
            {isRTL ? "تم جلب اسم الشارع تلقائياً من الخريطة" : "Street name auto-filled from map"}
          </Text>
        </View>
      )}

      <View style={styles.fieldWrap}>
        <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {t("register.street") || "الشارع"}
        </Text>
        <TextInput
          value={street}
          onChangeText={onStreetChange}
          placeholder={isRTL ? "اسم الشارع" : "Street Name"}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
        />
      </View>

      {showDetails && (
        <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.flex1}>
            <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{isRTL ? "المبنى" : "Bldg"}</Text>
            <TextInput
              value={building}
              onChangeText={onBuildingChange}
              placeholder="e.g. 14"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{isRTL ? "الدور" : "Floor"}</Text>
            <TextInput
              value={floor}
              onChangeText={onFloorChange}
              placeholder="e.g. 3"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{isRTL ? "الشقة" : "Apt"}</Text>
            <TextInput
              value={apartment}
              onChangeText={onApartmentChange}
              placeholder="e.g. 5"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
        </View>
      )}

      <MapPickerModal 
        visible={mapVisible} 
        onClose={() => setMapVisible(false)} 
        onConfirm={handleMapConfirm} 
        // تم مسح الأسطر المسببة للخطأ تماماً لتخطي تعارض الـ Props
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  mapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderWidth: 1.5, borderRadius: 10, marginVertical: 6 },
  fieldWrap: { gap: 4 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1.5, borderRadius: 8, fontSize: 14, fontFamily: "Inter_400Regular" },
  row: { gap: 8 },
  flex1: { flex: 1, gap: 4 },
  banner: { padding: 8, borderWidth: 1, borderRadius: 6, alignItems: "center" }
});