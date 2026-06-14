import React from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  displayNameAr?: string;
  displayNameEn?: string;
  suburbAr?: string;
  suburbEn?: string;
  cityAr?: string;
  cityEn?: string;
  street?: string;
}

interface MapPickerModalProps {
  visible: boolean;
  initialCoords?: { latitude: number; longitude: number } | null;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
}

export default function MapPickerModal({ visible, initialCoords, onConfirm, onClose }: MapPickerModalProps) {
  const colors = useColors();
  const { isRTL } = useApp();

  const handleConfirm = () => {
    onConfirm({
      latitude: initialCoords?.latitude ?? 31.2001,
      longitude: initialCoords?.longitude ?? 29.9187,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <VectorIcon name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isRTL ? "تحديد الموقع" : "Pin Location"}
          </Text>
          <TouchableOpacity
            onPress={handleConfirm}
            style={[styles.headerBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}
          >
            <VectorIcon name="check" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.fallback, { backgroundColor: colors.muted }]}>
          <VectorIcon name="map" size={48} color={colors.border} />
          <Text style={[styles.fallbackText, { color: colors.mutedForeground }]}>
            {isRTL
              ? "الخريطة التفاعلية متاحة على تطبيق الهاتف فقط"
              : "Interactive map is available on the mobile app only"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  fallbackText: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
});
