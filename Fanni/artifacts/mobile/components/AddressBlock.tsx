import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, FlatList,
} from "react-native";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { getApiBase } from "@/utils/api";
import MapPickerModal, { PickedLocation } from "./MapPickerModal";

export interface AddressValue {
  governorateId: string;
  governorateName: string;
  areaId: string;
  areaName: string;
  street: string;
  buildingNo: string;
  floorNo: string;
  aptNo: string;
  latitude: number | null;
  longitude: number | null;
}

export const EMPTY_ADDRESS: AddressValue = {
  governorateId: "", governorateName: "",
  areaId: "", areaName: "",
  street: "", buildingNo: "", floorNo: "", aptNo: "",
  latitude: null, longitude: null,
};

export interface AddressBlockProps {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  error?: string;
  showDetails?: boolean;
}

interface LocationOption { id: string; nameAr: string; nameEn: string; }

function fuzzyMatchLocation(name: string | undefined, list: LocationOption[]): LocationOption | undefined {
  if (!name || !name.trim()) return undefined;
  const clean = (s: string) =>
    s.toLowerCase().replace(/محافظة\s*/g, "").replace(/\s+/g, " ").trim();
  const q = clean(name);
  return (
    list.find(l => clean(l.nameAr) === q || clean(l.nameEn) === q) ??
    list.find(l => clean(l.nameAr).includes(q) || q.includes(clean(l.nameAr))) ??
    list.find(l => clean(l.nameEn).includes(q) || q.includes(clean(l.nameEn)))
  );
}

export default function AddressBlock({
  value, onChange, error, showDetails = true,
}: AddressBlockProps) {
  const colors = useColors();
  const { isRTL } = useApp();

  const [governorates, setGovernorates] = useState<LocationOption[]>([]);
  const [areas, setAreas] = useState<LocationOption[]>([]);
  const [loadingGov, setLoadingGov] = useState(false);
  const [loadingArea, setLoadingArea] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [govSheet, setGovSheet] = useState(false);
  const [areaSheet, setAreaSheet] = useState(false);
  const [autoFillBanner, setAutoFillBanner] = useState(false);

  useEffect(() => {
    const base = getApiBase();
    if (!base) return;
    setLoadingGov(true);
    fetch(`${base}/api/locations/governorates`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.governorates) setGovernorates(j.governorates); })
      .catch(() => {})
      .finally(() => setLoadingGov(false));
  }, []);

  useEffect(() => {
    if (!value.governorateId) { setAreas([]); return; }
    const base = getApiBase();
    if (!base) return;
    setLoadingArea(true);
    fetch(`${base}/api/locations/${value.governorateId}/areas`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.areas) setAreas(j.areas); })
      .catch(() => {})
      .finally(() => setLoadingArea(false));
  }, [value.governorateId]);

  const selectGovernorate = useCallback((opt: LocationOption) => {
    onChange({
      ...value,
      governorateId: opt.id,
      governorateName: isRTL ? opt.nameAr : opt.nameEn,
      areaId: "", areaName: "",
      street: "", latitude: null, longitude: null,
    });
    setGovSheet(false);
  }, [value, onChange, isRTL]);

  const selectArea = useCallback((opt: LocationOption) => {
    onChange({
      ...value,
      areaId: opt.id,
      areaName: isRTL ? opt.nameAr : opt.nameEn,
      street: "", latitude: null, longitude: null,
    });
    setAreaSheet(false);
  }, [value, onChange, isRTL]);

  const handleMapConfirm = useCallback((loc: PickedLocation) => {
    const street = loc.street ?? "";
    let govId = value.governorateId;
    let govName = value.governorateName;

    if (!govId && governorates.length > 0) {
      const matched =
        fuzzyMatchLocation(loc.stateAr, governorates) ??
        fuzzyMatchLocation(loc.stateEn, governorates) ??
        fuzzyMatchLocation(loc.cityAr, governorates) ??
        fuzzyMatchLocation(loc.cityEn, governorates);
      if (matched) {
        govId = matched.id;
        govName = isRTL ? matched.nameAr : matched.nameEn;
      }
    }

    onChange({
      ...value,
      governorateId: govId,
      governorateName: govName,
      street,
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    setMapVisible(false);
    if (street) {
      setAutoFillBanner(true);
      setTimeout(() => setAutoFillBanner(false), 3500);
    }
  }, [value, onChange, isRTL, governorates]);

  const confirmed = value.latitude != null && value.longitude != null;
  const govLabel = value.governorateId
    ? (governorates.find(g => g.id === value.governorateId)?.[isRTL ? "nameAr" : "nameEn"] ?? value.governorateName)
    : null;
  const areaLabel = value.areaId
    ? (areas.find(a => a.id === value.areaId)?.[isRTL ? "nameAr" : "nameEn"] ?? value.areaName)
    : null;

  return (
    <View>

      {/* ── Governorate ── */}
      <View style={s.field}>
        <Text style={[s.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "المحافظة *" : "Governorate *"}
        </Text>
        <TouchableOpacity
          style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setGovSheet(true)}
          activeOpacity={0.75}
        >
          {loadingGov
            ? <ActivityIndicator size="small" color={colors.primary} style={{ flex: 1 }} />
            : <>
                <Text style={{ color: govLabel ? colors.foreground : colors.mutedForeground, flex: 1, textAlign: isRTL ? "right" : "left", fontFamily: "Inter_400Regular" }}>
                  {govLabel ?? (isRTL ? "اختر المحافظة" : "Select Governorate")}
                </Text>
                <VectorIcon name="chevron-down" size={14} color={colors.mutedForeground} />
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ── Area / District ── */}
      <View style={s.field}>
        <Text style={[s.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "المنطقة / الحي *" : "Area / District *"}
        </Text>
        <TouchableOpacity
          style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border, opacity: value.governorateId ? 1 : 0.45 }]}
          onPress={() => { if (value.governorateId) setAreaSheet(true); }}
          activeOpacity={0.75}
        >
          {loadingArea
            ? <ActivityIndicator size="small" color={colors.primary} style={{ flex: 1 }} />
            : <>
                <Text style={{ color: areaLabel ? colors.foreground : colors.mutedForeground, flex: 1, textAlign: isRTL ? "right" : "left", fontFamily: "Inter_400Regular" }}>
                  {areaLabel ?? (isRTL ? "اختر المنطقة / الحي" : "Select Area / District")}
                </Text>
                <VectorIcon name="chevron-down" size={14} color={colors.mutedForeground} />
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ── Map Button (required) ── */}
      <View style={s.field}>
        <Text style={[s.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "تثبيت الموقع على الخريطة *" : "Pin Location on Map *"}
        </Text>
        <TouchableOpacity
          style={[s.mapBtn, {
            borderColor: confirmed ? "#10B981" : colors.primary,
            backgroundColor: confirmed ? "#10B98115" : colors.primary + "12",
          }]}
          onPress={() => setMapVisible(true)}
          activeOpacity={0.8}
        >
          <VectorIcon
            name={confirmed ? "check-circle" : "map-pin"}
            size={16}
            color={confirmed ? "#10B981" : colors.primary}
          />
          <Text style={{ color: confirmed ? "#10B981" : colors.primary, fontFamily: "Inter_600SemiBold", marginStart: 8 }}>
            {confirmed
              ? (isRTL ? "✓ تم تحديد الموقع — اضغط للتعديل" : "✓ Location set — tap to change")
              : (isRTL ? "تحديد الموقع على الخريطة" : "Pick Location on Map")}
          </Text>
        </TouchableOpacity>
        {error ? (
          <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 5, textAlign: isRTL ? "right" : "left" }}>
            {error}
          </Text>
        ) : null}
      </View>

      {/* ── Auto-fill banner ── */}
      {autoFillBanner && (
        <View style={[s.banner, { backgroundColor: "#ECFDF5", borderColor: "#10B981" }]}>
          <VectorIcon name="check" size={12} color="#065F46" />
          <Text style={{ color: "#065F46", fontSize: 12, fontFamily: "Inter_500Medium", marginStart: 6 }}>
            {isRTL ? "تم جلب اسم الشارع تلقائياً من الخريطة" : "Street name auto-filled from map"}
          </Text>
        </View>
      )}

      {/* ── Street (read-only — from map) ── */}
      <View style={s.field}>
        <Text style={[s.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
          {isRTL ? "اسم الشارع" : "Street Name"}
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
            {isRTL ? "  (يعبأ تلقائياً من الخريطة)" : "  (auto-filled from map)"}
          </Text>
        </Text>
        <View style={[s.readOnly, { backgroundColor: colors.muted ?? colors.card, borderColor: colors.border }]}>
          <Text style={{ color: value.street ? colors.foreground : colors.mutedForeground, flex: 1, textAlign: isRTL ? "right" : "left", fontFamily: "Inter_400Regular" }}>
            {value.street || (isRTL ? "يتعبأ بعد تحديد الموقع على الخريطة" : "Filled after map selection")}
          </Text>
          <VectorIcon name="lock" size={12} color={colors.mutedForeground} />
        </View>
      </View>

      {/* ── Building / Floor / Apt ── */}
      {showDetails && (
        <View style={[s.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
              {isRTL ? "رقم المبنى" : "Building #"}
            </Text>
            <TextInput
              value={value.buildingNo}
              onChangeText={v => onChange({ ...value, buildingNo: v })}
              placeholder="14"
              placeholderTextColor={colors.mutedForeground}
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
              {isRTL ? "رقم الدور" : "Floor #"}
            </Text>
            <TextInput
              value={value.floorNo}
              onChangeText={v => onChange({ ...value, floorNo: v })}
              placeholder="3"
              placeholderTextColor={colors.mutedForeground}
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
              {isRTL ? "رقم الشقة" : "Apt #"}
            </Text>
            <TextInput
              value={value.aptNo}
              onChangeText={v => onChange({ ...value, aptNo: v })}
              placeholder="5"
              placeholderTextColor={colors.mutedForeground}
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
        </View>
      )}

      {/* ── Governorate bottom sheet ── */}
      <Modal visible={govSheet} transparent animationType="slide" onRequestClose={() => setGovSheet(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setGovSheet(false)}>
          <View style={[s.sheet, { backgroundColor: colors.background }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>
              {isRTL ? "اختر المحافظة" : "Select Governorate"}
            </Text>
            <FlatList
              data={governorates}
              keyExtractor={i => i.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.option, {
                    borderBottomColor: colors.border,
                    backgroundColor: item.id === value.governorateId ? colors.primary + "18" : "transparent",
                  }]}
                  onPress={() => selectGovernorate(item)}
                >
                  <Text style={{ color: colors.foreground, fontFamily: item.id === value.governorateId ? "Inter_600SemiBold" : "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? item.nameAr : item.nameEn}
                  </Text>
                  {item.id === value.governorateId && (
                    <VectorIcon name="check" size={14} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Area bottom sheet ── */}
      <Modal visible={areaSheet} transparent animationType="slide" onRequestClose={() => setAreaSheet(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setAreaSheet(false)}>
          <View style={[s.sheet, { backgroundColor: colors.background }]}>
            <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>
              {isRTL ? "اختر المنطقة / الحي" : "Select Area / District"}
            </Text>
            <FlatList
              data={areas}
              keyExtractor={i => i.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.option, {
                    borderBottomColor: colors.border,
                    backgroundColor: item.id === value.areaId ? colors.primary + "18" : "transparent",
                  }]}
                  onPress={() => selectArea(item)}
                >
                  <Text style={{ color: colors.foreground, fontFamily: item.id === value.areaId ? "Inter_600SemiBold" : "Inter_400Regular", textAlign: isRTL ? "right" : "left" }}>
                    {isRTL ? item.nameAr : item.nameEn}
                  </Text>
                  {item.id === value.areaId && (
                    <VectorIcon name="check" size={14} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Map Modal ── */}
      <MapPickerModal
        visible={mapVisible}
        initialCoords={confirmed ? { latitude: value.latitude!, longitude: value.longitude! } : null}
        onConfirm={handleMapConfirm}
        onClose={() => setMapVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  dropdown: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 46,
  },
  mapBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderRadius: 10, paddingVertical: 13,
  },
  readOnly: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 46,
  },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  row: { gap: 8, marginBottom: 14 },
  banner: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, maxHeight: "70%" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontFamily: "Inter_700Bold", paddingHorizontal: 20, paddingBottom: 10 },
  option: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
