import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { LocationValue } from "@/hooks/useAddressSync";

interface LocationPickerV2Props {
  value?: Partial<LocationValue>;
  onChange: (location: LocationValue) => void;
  lang?: "ar" | "en";
  readOnly?: boolean;
  labels?: Record<string, string>;
}

export function LocationPickerV2({ lang = "ar" }: LocationPickerV2Props) {
  const colors = useColors();
  const isRTL = lang === "ar";
  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        {isRTL
          ? "منتقي الموقع التفاعلي متاح على تطبيق الهاتف فقط"
          : "Interactive location picker is available on the mobile app only"}
      </Text>
    </View>
  );
}

export default LocationPickerV2;
export type { LocationPickerV2Props, LocationValue };

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  text: {
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
});
