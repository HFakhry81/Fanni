import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  FlatList, TextInput, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import MapPickerModal, { type PickedLocation } from "@/components/MapPickerModal";

// ─── API helpers ───────────────────────────────────────────────────────────────

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

interface LocationRow {
  id: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  parentId?: string | null;
}

async function fetchGovernorates(): Promise<LocationRow[]> {
  const base = getApiBase();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/api/locations/governorates`);
    const json = await res.json();
    return json.governorates ?? [];
  } catch {
    return [];
  }
}

async function fetchAreas(govId: string): Promise<LocationRow[]> {
  const base = getApiBase();
  if (!base || !govId) return [];
  try {
    const res = await fetch(`${base}/api/locations/${govId}/areas`);
    const json = await res.json();
    return json.areas ?? [];
  } catch {
    return [];
  }
}

interface StreetSuggestion {
  label: string;
  lat: number;
  lon: number;
}

async function fetchStreetSuggestions(q: string, cityId: string, lang: string): Promise<StreetSuggestion[]> {
  const base = getApiBase();
  if (!base || q.length < 3) return [];
  try {
    const res = await fetch(
      `${base}/api/geo/streets?q=${encodeURIComponent(q)}&city_id=${encodeURIComponent(cityId)}&lang=${lang}`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.results ?? [];
  } catch {
    return [];
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PickerType = "governorate" | "area";

export interface LocationOption { id: string; ar: string; en: string; }

interface LocationPickerProps {
  governorateId: string;
  areaId: string;
  onGovernorateChange: (id: string) => void;
  onAreaChange: (id: string) => void;
  onGovernorateSelect?: (opt: LocationOption) => void;
  onAreaSelect?: (opt: LocationOption) => void;
  street: string;
  onStreetChange: (v: string) => void;
  building?: string;
  onBuildingChange?: (v: string) => void;
  floor?: string;
  onFloorChange?: (v: string) => void;
  apartment?: string;
  onApartmentChange?: (v: string) => void;
  showDetails?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  onCoordsChange?: (lat: number, lon: number) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function rowToOption(r: LocationRow): LocationOption {
  return { id: r.id, ar: r.nameAr, en: r.nameEn };
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
}

function optionMatches(opt: LocationOption, term: string): boolean {
  if (!term) return false;
  const t = normalise(term);
  if (t.length < 2) return false;
  return normalise(opt.en).includes(t) || normalise(opt.ar).includes(t);
}

// ─── Single dropdown ──────────────────────────────────────────────────────────

function Dropdown({
  label, value, placeholder, onPress, required, loading,
}: {
  label: string; value: string; placeholder: string;
  onPress: () => void; required?: boolean; loading?: boolean;
}) {
  const colors = useColors();
  const { isRTL } = useApp();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
        {label}{required ? " *" : ""}
      </Text>
      <TouchableOpacity
        style={[
          styles.dropdown,
          {
            backgroundColor: colors.card,
            borderColor: value ? colors.secondary : colors.border,
            borderRadius: 12,
            flexDirection: isRTL ? "row-reverse" : "row",
          },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.dropdownIcon, { backgroundColor: colors.accentBlue, borderRadius: 8 }]}>
          {loading
            ? <ActivityIndicator size="small" color={colors.secondary} />
            : <Feather name="map-pin" size={14} color={colors.secondary} />}
        </View>
        <Text
          style={[
            styles.dropdownText,
            {
              color: value ? colors.foreground : colors.mutedForeground,
              fontFamily: value ? "Inter_500Medium" : "Inter_400Regular",
              textAlign: isRTL ? "right" : "left",
              flex: 1,
              marginLeft: isRTL ? 0 : 10,
              marginRight: isRTL ? 10 : 0,
            },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Modal Picker ─────────────────────────────────────────────────────────────

function ModalPicker({
  visible, title, options, selectedId, onSelect, onClose, loading,
}: {
  visible: boolean; title: string; options: LocationOption[]; selectedId: string;
  onSelect: (opt: LocationOption) => void; onClose: () => void; loading?: boolean;
}) {
  const colors = useColors();
  const { isRTL } = useApp();
  const [search, setSearch] = useState("");

  useEffect(() => { if (!visible) setSearch(""); }, [visible]);

  const filtered = options.filter((o) => {
    const q = search.toLowerCase();
    return o.ar.includes(q) || o.en.toLowerCase().includes(q);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background, borderRadius: 24 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, flex: 1 }}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={[styles.searchWrap, { backgroundColor: colors.muted, borderRadius: 10, flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isRTL ? "بحث..." : "Search..."}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
            />
          </View>
          {loading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: isSelected ? colors.accent : "transparent",
                        borderBottomColor: colors.border,
                        flexDirection: isRTL ? "row-reverse" : "row",
                      },
                    ]}
                    onPress={() => { onSelect(item); onClose(); }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: isSelected ? colors.primary + "20" : colors.muted, borderRadius: 8 }]}>
                      <Feather name="map-pin" size={14} color={isSelected ? colors.primary : colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1, marginLeft: isRTL ? 0 : 10, marginRight: isRTL ? 10 : 0 }}>
                      <Text style={{ color: isSelected ? colors.primary : colors.foreground, fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_500Medium", fontSize: 15 }}>
                        {isRTL ? item.ar : item.en}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 }}>
                        {isRTL ? item.en : item.ar}
                      </Text>
                    </View>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 40 }}>
                  <Feather name="search" size={32} color={colors.border} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 10 }}>
                    {isRTL ? "لا توجد نتائج" : "No results"}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Inline input ─────────────────────────────────────────────────────────────

function InlineInput({
  label, value, onChange, placeholder, keyboardType,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; keyboardType?: "default" | "numeric";
}) {
  const colors = useColors();
  const { isRTL } = useApp();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? "default"}
        style={[
          styles.textInput,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12,
            color: colors.foreground,
            textAlign: isRTL ? "right" : "left",
          },
        ]}
      />
    </View>
  );
}

// ─── Street Autocomplete ───────────────────────────────────────────────────────

function StreetAutocomplete({
  value, onChange, cityId, onCoordsChange,
}: {
  value: string;
  onChange: (v: string) => void;
  cityId: string;
  onCoordsChange?: (lat: number, lon: number) => void;
}) {
  const colors = useColors();
  const { isRTL } = useApp();
  const [suggestions, setSuggestions] = useState<StreetSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3 || !cityId) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const lang = isRTL ? "ar" : "en";
      const results = await fetchStreetSuggestions(q, cityId, lang);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } finally {
      setLoading(false);
    }
  }, [cityId, isRTL]);

  const onChangeText = (text: string) => {
    onChange(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(text), 400);
  };

  const onSelect = (s: StreetSuggestion) => {
    onChange(s.label);
    setSuggestions([]);
    setShowDropdown(false);
    if (onCoordsChange && !isNaN(s.lat) && !isNaN(s.lon)) {
      onCoordsChange(s.lat, s.lon);
    }
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
        {isRTL ? "اسم الشارع" : "Street Name"}
      </Text>
      <View style={{ position: "relative" }}>
        <View style={[
          styles.streetInputWrap,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12,
            flexDirection: isRTL ? "row-reverse" : "row",
          },
        ]}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={isRTL ? "ابحث عن شارع أو اكتب العنوان..." : "Search or type street address..."}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.streetInput,
              {
                color: colors.foreground,
                textAlign: isRTL ? "right" : "left",
              },
            ]}
          />
          {loading && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 8 }} />
          )}
          {!loading && (
            <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginHorizontal: 8 }} />
          )}
        </View>

        {showDropdown && suggestions.length > 0 && (
          <View style={[styles.streetDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {suggestions.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.streetItem, { borderBottomColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" }]}
                onPress={() => onSelect(s)}
                activeOpacity={0.8}
              >
                <Feather name="map-pin" size={13} color={colors.primary} style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0, marginTop: 2 }} />
                <Text style={{ color: colors.foreground, fontSize: 13, flex: 1, textAlign: isRTL ? "right" : "left" }} numberOfLines={2}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LocationPicker({
  governorateId, areaId,
  onGovernorateChange, onAreaChange,
  onGovernorateSelect, onAreaSelect,
  street, onStreetChange,
  building = "", onBuildingChange,
  floor = "", onFloorChange,
  apartment = "", onApartmentChange,
  showDetails = true,
  latitude, longitude, onCoordsChange,
}: LocationPickerProps) {
  const colors = useColors();
  const { isRTL } = useApp();

  const [modalType, setModalType] = useState<PickerType | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [govOptions, setGovOptions] = useState<LocationOption[]>([]);
  const [areaOptions, setAreaOptions] = useState<LocationOption[]>([]);
  const [govLoading, setGovLoading] = useState(false);
  const [areaLoading, setAreaLoading] = useState(false);

  const loadGovernorates = useCallback(async () => {
    setGovLoading(true);
    const rows = await fetchGovernorates();
    setGovOptions(rows.map(rowToOption));
    setGovLoading(false);
  }, []);

  const loadAreas = useCallback(async (govId: string) => {
    if (!govId) { setAreaOptions([]); return; }
    setAreaLoading(true);
    const rows = await fetchAreas(govId);
    setAreaOptions(rows.map(rowToOption));
    setAreaLoading(false);
  }, []);

  useEffect(() => { loadGovernorates(); }, [loadGovernorates]);
  useEffect(() => { loadAreas(governorateId); }, [governorateId, loadAreas]);

  const govLabel = govOptions.find((g) => g.id === governorateId);
  const areaLabel = areaOptions.find((a) => a.id === areaId);

  const getModalOptions = (): LocationOption[] => {
    if (modalType === "governorate") return govOptions;
    if (modalType === "area") return areaOptions;
    return [];
  };

  const getModalTitle = (): string => {
    if (modalType === "governorate") return isRTL ? "اختر المحافظة" : "Select Governorate";
    return isRTL ? "اختر المنطقة / المدينة" : "Select Area / City";
  };

  const getModalLoading = (): boolean => {
    if (modalType === "governorate") return govLoading;
    return areaLoading;
  };

  const handleSelect = (opt: LocationOption) => {
    if (modalType === "governorate") {
      onGovernorateChange(opt.id);
      onGovernorateSelect?.(opt);
      onAreaChange("");
    } else if (modalType === "area") {
      onAreaChange(opt.id);
      onAreaSelect?.(opt);
    }
  };

  const handleMapConfirm = async (loc: PickedLocation) => {
    setShowMapPicker(false);
    onCoordsChange?.(loc.latitude, loc.longitude);

    if (loc.street && !street) {
      onStreetChange(loc.street);
    }

    const cityEn = loc.cityEn ?? "";
    const suburbEn = loc.suburbEn ?? "";
    const cityAr = loc.cityAr ?? "";
    const suburbAr = loc.suburbAr ?? "";

    if (govOptions.length > 0) {
      const govMatch = govOptions.find(
        (g) => optionMatches(g, cityEn) || optionMatches(g, cityAr),
      );
      if (govMatch && govMatch.id !== governorateId) {
        onGovernorateChange(govMatch.id);
        onGovernorateSelect?.(govMatch);
        onAreaChange("");

        const areaRows = await fetchAreas(govMatch.id);
        const areaOpts = areaRows.map(rowToOption);
        setAreaOptions(areaOpts);

        const areaMatch = areaOpts.find(
          (a) => optionMatches(a, suburbEn) || optionMatches(a, suburbAr) ||
                 optionMatches(a, cityEn)   || optionMatches(a, cityAr),
        );
        if (areaMatch) {
          onAreaChange(areaMatch.id);
          onAreaSelect?.(areaMatch);
        }
      } else if (areaOptions.length > 0) {
        const areaMatch = areaOptions.find(
          (a) => optionMatches(a, suburbEn) || optionMatches(a, suburbAr),
        );
        if (areaMatch && areaMatch.id !== areaId) {
          onAreaChange(areaMatch.id);
          onAreaSelect?.(areaMatch);
        }
      }
    }
  };

  const hasPinnedLocation = latitude != null && longitude != null;

  return (
    <View>
      <Dropdown
        label={isRTL ? "المحافظة" : "Governorate"}
        value={govLabel ? (isRTL ? govLabel.ar : govLabel.en) : ""}
        placeholder={isRTL ? "اختر المحافظة" : "Select Governorate"}
        onPress={() => setModalType("governorate")}
        loading={govLoading && govOptions.length === 0}
        required
      />

      <Dropdown
        label={isRTL ? "المنطقة / المدينة" : "Area / City"}
        value={areaLabel ? (isRTL ? areaLabel.ar : areaLabel.en) : ""}
        placeholder={governorateId ? (isRTL ? "اختر المنطقة" : "Select Area") : (isRTL ? "اختر المحافظة أولاً" : "Select governorate first")}
        onPress={() => governorateId && setModalType("area")}
        loading={areaLoading}
        required
      />

      <StreetAutocomplete
        value={street}
        onChange={onStreetChange}
        cityId={areaId}
        onCoordsChange={onCoordsChange}
      />

      {showDetails && (
        <View style={[styles.detailRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={{ flex: 1 }}>
            <InlineInput label={isRTL ? "رقم المبنى" : "Building"} value={building} onChange={onBuildingChange ?? (() => {})} placeholder="15" keyboardType="numeric" />
          </View>
          <View style={{ width: 8 }} />
          <View style={{ flex: 1 }}>
            <InlineInput label={isRTL ? "الطابق" : "Floor"} value={floor} onChange={onFloorChange ?? (() => {})} placeholder="3" keyboardType="numeric" />
          </View>
          <View style={{ width: 8 }} />
          <View style={{ flex: 1 }}>
            <InlineInput label={isRTL ? "الشقة" : "Apt"} value={apartment} onChange={onApartmentChange ?? (() => {})} placeholder="12" keyboardType="numeric" />
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.mapPlaceholder,
          {
            backgroundColor: hasPinnedLocation ? colors.primary + "15" : colors.accentBlue,
            borderColor: hasPinnedLocation ? colors.primary : colors.secondary,
            borderRadius: 14,
          },
        ]}
        onPress={() => setShowMapPicker(true)}
        activeOpacity={0.8}
      >
        <Feather
          name={hasPinnedLocation ? "check-circle" : "navigation"}
          size={22}
          color={hasPinnedLocation ? colors.primary : colors.secondary}
        />
        <Text style={{ color: hasPinnedLocation ? colors.primary : colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 6, textAlign: "center" }}>
          {hasPinnedLocation
            ? (isRTL ? "تم تحديد الموقع ✓" : "Location pinned ✓")
            : (isRTL ? "تحديد الموقع على الخريطة" : "Pin location on map")}
        </Text>
        {hasPinnedLocation ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
            {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
          </Text>
        ) : (
          <Text style={{ color: colors.secondary + "99", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
            {isRTL ? "الإسكندرية — مصر" : "Alexandria — Egypt"}
          </Text>
        )}
      </TouchableOpacity>

      <ModalPicker
        visible={modalType !== null}
        title={getModalTitle()}
        options={getModalOptions()}
        selectedId={modalType === "governorate" ? governorateId : areaId}
        onSelect={handleSelect}
        onClose={() => setModalType(null)}
        loading={getModalLoading()}
      />

      <MapPickerModal
        visible={showMapPicker}
        initialCoords={hasPinnedLocation ? { latitude: latitude!, longitude: longitude! } : null}
        onConfirm={handleMapConfirm}
        onClose={() => setShowMapPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: 12 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 },
  dropdown: {
    padding: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  dropdownIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  dropdownText: { fontSize: 14 },
  streetInputWrap: {
    borderWidth: 1.5,
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  streetInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  streetDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 999,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 220,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  streetItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    alignItems: "flex-start",
  },
  textInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  detailRow: { gap: 0 },
  mapPlaceholder: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { height: "75%", paddingHorizontal: 16, paddingBottom: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 },
  modalHeader: { alignItems: "center", paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1 },
  searchWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  optionItem: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, alignItems: "center" },
  optionIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
