import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  FlatList, TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import {
  EGYPT_LOCATIONS, Governorate, Area, Neighborhood,
  getAreas, getNeighborhoods, DEFAULT_GOVERNORATE,
} from "@/constants/egyptLocations";

// ─── Types ────────────────────────────────────────────────────────────────────

type PickerType = "governorate" | "area" | "neighborhood";

interface Option { id: string; ar: string; en: string; }

interface LocationPickerProps {
  /** Selected governorate id */
  governorateId: string;
  /** Selected area id */
  areaId: string;
  /** Selected neighborhood id */
  neighborhoodId: string;
  /** Callbacks */
  onGovernorateChange: (id: string) => void;
  onAreaChange: (id: string) => void;
  onNeighborhoodChange: (id: string) => void;
  /** Additional address street field */
  street: string;
  onStreetChange: (v: string) => void;
  /** Building / floor / apt */
  building?: string;
  onBuildingChange?: (v: string) => void;
  floor?: string;
  onFloorChange?: (v: string) => void;
  apartment?: string;
  onApartmentChange?: (v: string) => void;
  /** Show the street / building fields? */
  showDetails?: boolean;
}

// ─── Helper: single dropdown ───────────────────────────────────────────────

interface DropdownProps {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  required?: boolean;
}

function Dropdown({ label, value, placeholder, onPress, required }: DropdownProps) {
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
          <Feather name="map-pin" size={14} color={colors.secondary} />
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

interface ModalPickerProps {
  visible: boolean;
  title: string;
  options: Option[];
  selectedId: string;
  onSelect: (opt: Option) => void;
  onClose: () => void;
}

function ModalPicker({ visible, title, options, selectedId, onSelect, onClose }: ModalPickerProps) {
  const colors = useColors();
  const { isRTL } = useApp();
  const [search, setSearch] = useState("");

  const filtered = options.filter((o) => {
    const q = search.toLowerCase();
    return o.ar.includes(q) || o.en.toLowerCase().includes(q);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background, borderRadius: 24 }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {/* Header */}
          <View style={[styles.modalHeader, { flexDirection: isRTL ? "row-reverse" : "row", borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 17, flex: 1 }}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {/* Search */}
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
          {/* List */}
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
                  onPress={() => { onSelect(item); onClose(); setSearch(""); }}
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
        </View>
      </View>
    </Modal>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────

function InlineInput({ label, value, onChange, placeholder, keyboardType }: {
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LocationPicker({
  governorateId, areaId, neighborhoodId,
  onGovernorateChange, onAreaChange, onNeighborhoodChange,
  street, onStreetChange,
  building = "", onBuildingChange,
  floor = "", onFloorChange,
  apartment = "", onApartmentChange,
  showDetails = true,
}: LocationPickerProps) {
  const colors = useColors();
  const { isRTL } = useApp();

  const [modalType, setModalType] = useState<PickerType | null>(null);

  // Build option lists
  const govOptions: Option[] = EGYPT_LOCATIONS.map((g) => ({ id: g.id, ar: g.ar, en: g.en }));
  const areaOptions: Option[] = getAreas(governorateId).map((a) => ({ id: a.id, ar: a.ar, en: a.en }));
  const nbhOptions: Option[] = getNeighborhoods(governorateId, areaId).map((n) => ({ id: n.id, ar: n.ar, en: n.en }));

  const govLabel = govOptions.find((g) => g.id === governorateId);
  const areaLabel = areaOptions.find((a) => a.id === areaId);
  const nbhLabel = nbhOptions.find((n) => n.id === neighborhoodId);

  const getModalOptions = (): Option[] => {
    if (modalType === "governorate") return govOptions;
    if (modalType === "area") return areaOptions;
    if (modalType === "neighborhood") return nbhOptions;
    return [];
  };

  const getModalTitle = (): string => {
    if (modalType === "governorate") return isRTL ? "اختر المحافظة" : "Select Governorate";
    if (modalType === "area")        return isRTL ? "اختر المنطقة"  : "Select Area";
    return isRTL ? "اختر الحي"     : "Select Neighborhood";
  };

  const handleSelect = (opt: Option) => {
    if (modalType === "governorate") {
      onGovernorateChange(opt.id);
      onAreaChange("");
      onNeighborhoodChange("");
    } else if (modalType === "area") {
      onAreaChange(opt.id);
      onNeighborhoodChange("");
    } else {
      onNeighborhoodChange(opt.id);
    }
  };

  const getSelectedId = (): string => {
    if (modalType === "governorate") return governorateId;
    if (modalType === "area") return areaId;
    return neighborhoodId;
  };

  return (
    <View>
      {/* Governorate */}
      <Dropdown
        label={isRTL ? "المحافظة" : "Governorate"}
        value={govLabel ? (isRTL ? govLabel.ar : govLabel.en) : ""}
        placeholder={isRTL ? "اختر المحافظة" : "Select Governorate"}
        onPress={() => setModalType("governorate")}
        required
      />

      {/* Area */}
      <Dropdown
        label={isRTL ? "المنطقة / الحي الرئيسي" : "Area / District"}
        value={areaLabel ? (isRTL ? areaLabel.ar : areaLabel.en) : ""}
        placeholder={governorateId ? (isRTL ? "اختر المنطقة" : "Select Area") : (isRTL ? "اختر المحافظة أولاً" : "Select governorate first")}
        onPress={() => governorateId && setModalType("area")}
        required
      />

      {/* Neighborhood */}
      <Dropdown
        label={isRTL ? "الحي / الحارة" : "Neighborhood"}
        value={nbhLabel ? (isRTL ? nbhLabel.ar : nbhLabel.en) : ""}
        placeholder={areaId ? (isRTL ? "اختر الحي" : "Select Neighborhood") : (isRTL ? "اختر المنطقة أولاً" : "Select area first")}
        onPress={() => areaId && setModalType("neighborhood")}
      />

      {/* Street */}
      <InlineInput
        label={isRTL ? "اسم الشارع" : "Street Name"}
        value={street}
        onChange={onStreetChange}
        placeholder={isRTL ? "مثال: شارع النصر" : "e.g. Al Nasr Street"}
      />

      {/* Building / Floor / Apt */}
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

      {/* Map placeholder */}
      <TouchableOpacity style={[styles.mapPlaceholder, { backgroundColor: colors.accentBlue, borderColor: colors.secondary, borderRadius: 14 }]}>
        <Feather name="navigation" size={22} color={colors.secondary} />
        <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 6, textAlign: "center" }}>
          {isRTL ? "تحديد الموقع على الخريطة" : "Pin location on map"}
        </Text>
        <Text style={{ color: colors.secondary + "99", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
          {isRTL ? "الإسكندرية — مصر" : "Alexandria — Egypt"}
        </Text>
      </TouchableOpacity>

      {/* Picker Modal */}
      <ModalPicker
        visible={modalType !== null}
        title={getModalTitle()}
        options={getModalOptions()}
        selectedId={getSelectedId()}
        onSelect={handleSelect}
        onClose={() => setModalType(null)}
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
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { height: "75%", paddingHorizontal: 16, paddingBottom: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 },
  modalHeader: { alignItems: "center", paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1 },
  searchWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  optionItem: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, alignItems: "center" },
  optionIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
