/**
 * LocationPickerV2.tsx
 * مكوّن اختيار الموقع الجغرافي — النسخة المعاد تصميمها بالكامل
 *
 * التدفق:
 *   الخطوة 1: اختيار المحافظة (Dropdown) → الخريطة تتحرك لمركزها
 *   الخطوة 2: اختيار المنطقة/الحي  (Dropdown) → الخريطة تزوم أكثر
 *   الخطوة 3: تحديد الدبوس بدقة على الخريطة → reverse geocoding → تعبئة الشارع
 *   الخطوة 4: تعبئة رقم المبنى / الطابق / الشقة → تأكيد
 *
 * الربط الكامل:
 *   - الإحداثيات هي مصدر الحقيقة
 *   - الشارع مشتق من reverse geocoding
 *   - إذا عدّل المستخدم الشارع يدوياً → تحذير + إلزام بتأكيد الدبوس مجدداً
 */

import React, { useRef, useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  I18nManager,
  FlatList,
  Dimensions,
  Animated,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

// ── Imports داخلية (مطابقة لهيكل المشروع) ──────────────────
import { useColors } from "../hooks/useColors";
import { useAddressSync, LocationValue } from "../hooks/useAddressSync";
import {
  EGYPT_GOV_COORDINATES,
  EGYPT_CENTER,
  getGovById,
  GovCoordinate,
} from "../constants/egyptLocations";
import { getApiBase } from "../utils/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const IS_RTL = I18nManager.isRTL;

// ─────────────────────────────────────────────────────────────
// Types & Props
// ─────────────────────────────────────────────────────────────

interface ApiArea {
  id: string;
  nameAr: string;
  nameEn: string;
  lat?: number;
  lng?: number;
}

interface LocationPickerV2Props {
  /** القيمة الحالية للموقع */
  value?: Partial<LocationValue>;
  /** callback عند اكتمال الاختيار */
  onChange: (location: LocationValue) => void;
  /** رمز اللغة */
  lang?: "ar" | "en";
  /** هل الحقل للقراءة فقط؟ */
  readOnly?: boolean;
  /** نصوص الواجهة (مرر من i18n الخاص بالتطبيق) */
  labels?: Partial<typeof DEFAULT_LABELS>;
}

const DEFAULT_LABELS = {
  stepGovernorate: "اختر المحافظة",
  stepArea: "اختر المنطقة / الحي",
  stepPin: "حدد موقعك بدقة على الخريطة",
  stepDetails: "بيانات العنوان التفصيلية",
  governorate: "المحافظة",
  area: "المنطقة / المدينة",
  street: "اسم الشارع",
  building: "رقم المبنى",
  floor: "الطابق",
  apartment: "الشقة",
  searchPlaceholder: "ابحث...",
  pinInstruction: "حرك الخريطة لضبط موضع الدبوس",
  confirmLocation: "تأكيد الموقع",
  changePin: "تغيير الموقع",
  streetPlaceholder: "اكتب اسم الشارع أو سيتعبأ تلقائياً",
  warningMismatch: "⚠ العنوان المكتوب لا يتطابق مع الموقع المحدد. أكد الدبوس أو عدّل العنوان.",
  warningPartial: "⚠ تطابق جزئي بين العنوان والموقع.",
  selectGovFirst: "اختر المحافظة أولاً",
  openMapFull: "فتح الخريطة لتحديد الموقع",
  locationSummary: "الموقع المحدد",
  required: "*",
};

// ─────────────────────────────────────────────────────────────
// Sub-component: SearchableDropdown
// ─────────────────────────────────────────────────────────────

interface DropdownItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableDropdownProps {
  items: DropdownItem[];
  selectedId: string;
  onSelect: (item: DropdownItem) => void;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
  colors: ReturnType<typeof useColors>;
}

function SearchableDropdown({
  items,
  selectedId,
  onSelect,
  placeholder,
  searchPlaceholder,
  disabled,
  colors,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = items.find((i) => i.id === selectedId);

  const filtered = query.trim()
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(query.toLowerCase()) ||
          (i.sublabel ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : items;

  const styles = useDropdownStyles(colors);

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="location-outline" size={20} color={disabled ? colors.textMuted : colors.primary} />
        <Text
          style={[
            styles.triggerText,
            !selected && styles.triggerPlaceholder,
            disabled && styles.triggerDisabledText,
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={disabled ? colors.textMuted : colors.textSecondary}
        />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Search Bar */}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
                textAlign={IS_RTL ? "right" : "left"}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionRow, item.id === selectedId && styles.optionRowSelected]}
                  onPress={() => {
                    onSelect(item);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {item.id === selectedId && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={styles.checkIcon} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, item.id === selectedId && styles.optionLabelSelected]}>
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={styles.optionSublabel}>{item.sublabel}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>لا توجد نتائج</Text>
                </View>
              }
            />

            <TouchableOpacity style={styles.closeBtn} onPress={() => { setQuery(""); setOpen(false); }}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: MapPinModal (الخريطة الكاملة مع الدبوس)
// ─────────────────────────────────────────────────────────────

interface MapPinModalProps {
  visible: boolean;
  initialRegion: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  currentCoords: { lat: number; lng: number } | null;
  isGeocoding: boolean;
  geocodedStreet: string;
  onPinMoved: (lat: number, lng: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  labels: typeof DEFAULT_LABELS;
}

function MapPinModal({
  visible,
  initialRegion,
  currentCoords,
  isGeocoding,
  geocodedStreet,
  onPinMoved,
  onConfirm,
  onClose,
  colors,
  labels,
}: MapPinModalProps) {
  const mapRef = useRef<MapView>(null);
  const styles = useMapModalStyles(colors);

  // حركة أنيميشن للدبوس عند تحريك الخريطة
  const pinScale = useRef(new Animated.Value(1)).current;

  const handleRegionChange = useCallback(() => {
    Animated.spring(pinScale, { toValue: 1.2, useNativeDriver: true, speed: 20 }).start();
  }, [pinScale]);

  const handleRegionChangeComplete = useCallback(
    (region: { latitude: number; longitude: number }) => {
      Animated.spring(pinScale, { toValue: 1, useNativeDriver: true }).start();
      onPinMoved(region.latitude, region.longitude);
    },
    [onPinMoved, pinScale]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton
          showsCompass
          mapType="standard"
        />

        {/* Center Pin (Uber-style — stays fixed, map moves) */}
        <View style={styles.pinContainer} pointerEvents="none">
          <Animated.View style={{ transform: [{ scale: pinScale }] }}>
            <Ionicons name="location" size={48} color={colors.primary} />
          </Animated.View>
          <View style={[styles.pinShadow, { backgroundColor: colors.primary + "40" }]} />
        </View>

        {/* Back Button */}
        <TouchableOpacity style={[styles.fabClose, { backgroundColor: colors.darkMid }]} onPress={onClose}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {/* Address Card at Bottom */}
        <View style={[styles.addressCard, { backgroundColor: colors.darkMid }]}>
          <View style={styles.addressRow}>
            <Ionicons name="navigate-circle-outline" size={22} color={colors.primary} />
            {isGeocoding ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 8 }} />
            ) : (
              <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                {geocodedStreet || labels.pinInstruction}
              </Text>
            )}
          </View>
          <Text style={[styles.instructionText, { color: colors.textMuted }]}>
            {labels.pinInstruction}
          </Text>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={() => { onConfirm(); onClose(); }}
            disabled={isGeocoding}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.confirmBtnText}>{labels.confirmLocation}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component: LocationPickerV2
// ─────────────────────────────────────────────────────────────

export function LocationPickerV2({
  value = {},
  onChange,
  lang = "ar",
  readOnly = false,
  labels: customLabels = {},
}: LocationPickerV2Props) {
  const colors = useColors();
  const labels = { ...DEFAULT_LABELS, ...customLabels };
  const styles = useMainStyles(colors);

  const sync = useAddressSync(value, lang);
  const [mapVisible, setMapVisible] = useState(false);

  // ── Notify parent on every meaningful change ─────────────
  useEffect(() => {
    onChange(sync.location);
  }, [sync.location]);

  // ── Fetch Governorates (Arabic names from API) ────────────
  const { data: apiGovs = [] } = useQuery<{ id: string; nameAr: string; nameEn: string }[]>({
    queryKey: ["governorates"],
    queryFn: async () => {
      const res = await fetch(`${getApiBase()}/api/locations/governorates`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Merge API names with coordinates data
  const govItems: DropdownItem[] = EGYPT_GOV_COORDINATES.map((g) => {
    const api = apiGovs.find((a) => a.id === g.id);
    return {
      id: g.id,
      label: api ? (lang === "ar" ? api.nameAr : api.nameEn) : (lang === "ar" ? g.nameAr : g.nameEn),
      sublabel: lang === "ar" ? g.nameEn : g.nameAr,
    };
  });

  // ── Fetch Areas for selected Governorate ─────────────────
  const { data: areas = [], isFetching: areasLoading } = useQuery<ApiArea[]>({
    queryKey: ["areas", sync.location.governorateId],
    enabled: !!sync.location.governorateId,
    queryFn: async () => {
      const res = await fetch(
        `${getApiBase()}/api/locations/${sync.location.governorateId}/areas`
      );
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const areaItems: DropdownItem[] = areas.map((a) => ({
    id: a.id,
    label: lang === "ar" ? a.nameAr : a.nameEn,
  }));

  // ── Map Region calculation ────────────────────────────────
  const selectedGov = getGovById(sync.location.governorateId);
  const selectedArea = areas.find((a) => a.id === sync.location.areaId);

  const mapRegion = (() => {
    if (sync.location.latitude && sync.location.longitude) {
      return {
        latitude: sync.location.latitude,
        longitude: sync.location.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
    }
    if (selectedArea?.lat && selectedArea?.lng) {
      return {
        latitude: selectedArea.lat,
        longitude: selectedArea.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    if (selectedGov) {
      return {
        latitude: selectedGov.lat,
        longitude: selectedGov.lng,
        latitudeDelta: selectedGov.latitudeDelta,
        longitudeDelta: selectedGov.longitudeDelta,
      };
    }
    return {
      latitude: EGYPT_CENTER.lat,
      longitude: EGYPT_CENTER.lng,
      latitudeDelta: EGYPT_CENTER.latitudeDelta,
      longitudeDelta: EGYPT_CENTER.longitudeDelta,
    };
  })();

  // ── Handle Governorate selection ─────────────────────────
  const handleGovSelect = useCallback(
    (item: DropdownItem) => {
      sync.setGovernorate(item.id, item.label);
    },
    [sync]
  );

  // ── Handle Area selection ─────────────────────────────────
  const handleAreaSelect = useCallback(
    (item: DropdownItem) => {
      sync.setArea(item.id, item.label);
      // Open map automatically after area selection
      setTimeout(() => setMapVisible(true), 300);
    },
    [sync]
  );

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  const hasPin = sync.location.latitude !== null;
  const isConfirmed = sync.location.pinConfirmed;

  return (
    <View style={styles.container}>

      {/* ── Step 1: Governorate ── */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          {labels.governorate}
          <Text style={styles.required}> {labels.required}</Text>
        </Text>
        <SearchableDropdown
          items={govItems}
          selectedId={sync.location.governorateId}
          onSelect={handleGovSelect}
          placeholder={labels.stepGovernorate}
          searchPlaceholder={labels.searchPlaceholder}
          disabled={readOnly}
          colors={colors}
        />
      </View>

      {/* ── Step 2: Area ── */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          {labels.area}
          <Text style={styles.required}> {labels.required}</Text>
        </Text>
        {areasLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>جاري تحميل المناطق...</Text>
          </View>
        ) : (
          <SearchableDropdown
            items={areaItems}
            selectedId={sync.location.areaId}
            onSelect={handleAreaSelect}
            placeholder={
              sync.location.governorateId
                ? labels.stepArea
                : labels.selectGovFirst
            }
            searchPlaceholder={labels.searchPlaceholder}
            disabled={!sync.location.governorateId || readOnly}
            colors={colors}
          />
        )}
      </View>

      {/* ── Step 3: Map Pin ── */}
      {sync.location.areaId && (
        <View style={styles.fieldGroup}>
          {/* Inline mini-map preview */}
          <View style={[styles.mapPreviewContainer, { borderColor: isConfirmed ? colors.success : colors.border }]}>
            {hasPin && (
              <MapView
                style={styles.mapPreview}
                provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                region={{
                  latitude: sync.location.latitude!,
                  longitude: sync.location.longitude!,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                pointerEvents="none"
              >
                <Marker
                  coordinate={{
                    latitude: sync.location.latitude!,
                    longitude: sync.location.longitude!,
                  }}
                  pinColor={colors.primary}
                />
              </MapView>
            )}

            {/* Open map button overlay */}
            <TouchableOpacity
              style={[
                styles.openMapOverlay,
                hasPin && styles.openMapOverlaySmall,
                { backgroundColor: hasPin ? colors.primary + "CC" : colors.darkMid },
              ]}
              onPress={() => setMapVisible(true)}
              disabled={readOnly}
            >
              <Ionicons name="navigate" size={hasPin ? 20 : 28} color="#fff" />
              <Text style={[styles.openMapText, hasPin && styles.openMapTextSmall]}>
                {isConfirmed ? labels.changePin : labels.openMapFull}
              </Text>
              {isConfirmed && (
                <View style={styles.confirmedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Step 4: Address Details ── */}
      {isConfirmed && (
        <View style={styles.detailsSection}>
          {/* Street */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{labels.street}</Text>
            <View style={[
              styles.inputWrapper,
              sync.addressMatchStatus === "mismatch" && styles.inputWrapperError,
              sync.addressMatchStatus === "partial_match" && styles.inputWrapperWarning,
            ]}>
              <Ionicons
                name={sync.isGeocoding ? "refresh" : "map-outline"}
                size={18}
                color={sync.isGeocoding ? colors.primary : colors.textMuted}
              />
              <TextInput
                style={[styles.input, { color: colors.text, textAlign: IS_RTL ? "right" : "left" }]}
                value={sync.location.street}
                onChangeText={sync.onStreetManualChange}
                placeholder={labels.streetPlaceholder}
                placeholderTextColor={colors.textMuted}
                editable={!readOnly}
              />
              {sync.isGeocoding && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>

            {/* Address Match Warnings */}
            {sync.addressMatchStatus === "mismatch" && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={16} color={colors.error} />
                <Text style={[styles.warningText, { color: colors.error }]}>
                  {labels.warningMismatch}
                </Text>
              </View>
            )}
            {sync.addressMatchStatus === "partial_match" && (
              <View style={[styles.warningBox, { borderColor: colors.warning }]}>
                <Ionicons name="information-circle" size={16} color={colors.warning} />
                <Text style={[styles.warningText, { color: colors.warning }]}>
                  {labels.warningPartial}
                </Text>
              </View>
            )}
          </View>

          {/* Building / Floor / Apartment */}
          <View style={styles.rowThree}>
            {[
              { label: labels.building, value: sync.location.building, setter: sync.setBuilding },
              { label: labels.floor,    value: sync.location.floor,    setter: sync.setFloor    },
              { label: labels.apartment,value: sync.location.apartment,setter: sync.setApartment},
            ].map((field) => (
              <View key={field.label} style={styles.thirdField}>
                <Text style={[styles.label, styles.labelSmall]}>{field.label}</Text>
                <TextInput
                  style={[styles.inputSmall, { color: colors.text, borderColor: colors.border, textAlign: "center" }]}
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  editable={!readOnly}
                />
              </View>
            ))}
          </View>

          {/* Location Summary Chip */}
          {sync.location.latitude && (
            <View style={[styles.summaryChip, { backgroundColor: colors.success + "20", borderColor: colors.success }]}>
              <Ionicons name="location" size={14} color={colors.success} />
              <Text style={[styles.summaryText, { color: colors.success }]} numberOfLines={1}>
                {sync.location.governorateName}
                {sync.location.areaName ? ` · ${sync.location.areaName}` : ""}
                {sync.location.street ? ` · ${sync.location.street}` : ""}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Map Pin Modal ── */}
      <MapPinModal
        visible={mapVisible}
        initialRegion={mapRegion}
        currentCoords={
          sync.location.latitude !== null
            ? { lat: sync.location.latitude, lng: sync.location.longitude! }
            : null
        }
        isGeocoding={sync.isGeocoding}
        geocodedStreet={sync.location.geocodedStreet}
        onPinMoved={sync.onPinMoved}
        onConfirm={sync.confirmPin}
        onClose={() => setMapVisible(false)}
        colors={colors}
        labels={labels}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

function useMainStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      width: "100%",
    },
    fieldGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
      textAlign: IS_RTL ? "right" : "left",
    },
    labelSmall: {
      fontSize: 12,
      marginBottom: 4,
    },
    required: {
      color: colors.error,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    mapPreviewContainer: {
      height: 160,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 2,
      backgroundColor: colors.darkMid,
    },
    mapPreview: {
      ...StyleSheet.absoluteFillObject,
    },
    openMapOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      borderRadius: 10,
    },
    openMapOverlaySmall: {
      top: undefined,
      bottom: 0,
      left: 0,
      right: 0,
      height: 44,
      borderRadius: 0,
      flexDirection: "row",
      justifyContent: "center",
    },
    openMapText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600",
    },
    openMapTextSmall: {
      fontSize: 13,
      fontWeight: "500",
    },
    confirmedBadge: {
      marginLeft: 4,
    },
    detailsSection: {
      gap: 8,
    },
    inputWrapper: {
      flexDirection: IS_RTL ? "row-reverse" : "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.darkMid,
      paddingHorizontal: 12,
      paddingVertical: 4,
      gap: 8,
    },
    inputWrapperError: {
      borderColor: colors.error,
    },
    inputWrapperWarning: {
      borderColor: colors.warning ?? "#F5A623",
    },
    input: {
      flex: 1,
      fontSize: 14,
      paddingVertical: 10,
      fontFamily: "Inter",
    },
    warningBox: {
      flexDirection: IS_RTL ? "row-reverse" : "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 6,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.error + "15",
    },
    warningText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      textAlign: IS_RTL ? "right" : "left",
    },
    rowThree: {
      flexDirection: IS_RTL ? "row-reverse" : "row",
      gap: 8,
    },
    thirdField: {
      flex: 1,
    },
    inputSmall: {
      borderWidth: 1.5,
      borderRadius: 10,
      backgroundColor: colors.darkMid,
      paddingVertical: 10,
      paddingHorizontal: 8,
      fontSize: 14,
      fontFamily: "Inter",
    },
    summaryChip: {
      flexDirection: IS_RTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      marginTop: 4,
      alignSelf: "flex-start",
    },
    summaryText: {
      fontSize: 12,
      fontWeight: "500",
      maxWidth: 260,
    },
  });
}

function useDropdownStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    trigger: {
      flexDirection: IS_RTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.darkMid,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    triggerDisabled: {
      opacity: 0.5,
    },
    triggerText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      textAlign: IS_RTL ? "right" : "left",
      fontFamily: "Inter",
    },
    triggerPlaceholder: {
      color: colors.textMuted,
    },
    triggerDisabledText: {
      color: colors.textMuted,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "#00000088",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.dark,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: SCREEN_HEIGHT * 0.75,
      paddingBottom: 24,
    },
    searchRow: {
      flexDirection: IS_RTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 8,
      margin: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.darkMid,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontFamily: "Inter",
    },
    optionRow: {
      flexDirection: IS_RTL ? "row-reverse" : "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionRowSelected: {
      backgroundColor: colors.primary + "20",
    },
    checkIcon: {
      marginRight: IS_RTL ? 0 : 10,
      marginLeft: IS_RTL ? 10 : 0,
    },
    optionLabel: {
      fontSize: 15,
      color: colors.text,
      textAlign: IS_RTL ? "right" : "left",
      fontFamily: "Inter",
    },
    optionLabelSelected: {
      color: colors.primary,
      fontWeight: "600",
    },
    optionSublabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      textAlign: IS_RTL ? "right" : "left",
    },
    emptyBox: {
      padding: 32,
      alignItems: "center",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    closeBtn: {
      position: "absolute",
      top: 16,
      right: IS_RTL ? undefined : 16,
      left: IS_RTL ? 16 : undefined,
      padding: 6,
    },
  });
}

function useMapModalStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000",
    },
    map: {
      flex: 1,
    },
    pinContainer: {
      position: "absolute",
      top: "50%",
      left: "50%",
      marginLeft: -24,
      marginTop: -52,
      alignItems: "center",
    },
    pinShadow: {
      width: 20,
      height: 8,
      borderRadius: 10,
      marginTop: 2,
    },
    fabClose: {
      position: "absolute",
      top: Platform.OS === "ios" ? 52 : 16,
      left: IS_RTL ? undefined : 16,
      right: IS_RTL ? 16 : undefined,
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    addressCard: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
      gap: 10,
    },
    addressRow: {
      flexDirection: IS_RTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 10,
    },
    addressText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      textAlign: IS_RTL ? "right" : "left",
      fontFamily: "Inter",
    },
    instructionText: {
      fontSize: 12,
      textAlign: "center",
      fontFamily: "Inter",
    },
    confirmBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 4,
    },
    confirmBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "Inter",
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Export default
// ─────────────────────────────────────────────────────────────

export default LocationPickerV2;
export type { LocationPickerV2Props, LocationValue };
