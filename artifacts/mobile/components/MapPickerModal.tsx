import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, FlatList, ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const ALEX_COORDS = { latitude: 31.2001, longitude: 29.9187 };
const DEFAULT_DELTA = { latitudeDelta: 0.08, longitudeDelta: 0.08 };

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

export interface PickedLocation {
  latitude: number;
  longitude: number;
  displayName?: string;
  suburb?: string;
  city?: string;
  street?: string;
}

interface MapPickerModalProps {
  visible: boolean;
  initialCoords?: { latitude: number; longitude: number } | null;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
}

type MapComponents = {
  MapView: React.ComponentType<import("react-native-maps").MapViewProps>;
  Marker: React.ComponentType<import("react-native-maps").MarkerProps>;
  UrlTile: React.ComponentType<import("react-native-maps").UrlTileProps>;
};

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: { suburb?: string; city?: string; road?: string };
}

export default function MapPickerModal({
  visible, initialCoords, onConfirm, onClose,
}: MapPickerModalProps) {
  const colors = useColors();
  const { isRTL } = useApp();

  const [components, setComponents] = useState<MapComponents | null>(null);
  const mapRef = useRef<import("react-native-maps").default | null>(null);

  const [markerCoords, setMarkerCoords] = useState(
    initialCoords ?? ALEX_COORDS,
  );
  const [regionCoords, setRegionCoords] = useState(
    initialCoords ?? ALEX_COORDS,
  );

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reverseLoading, setReverseLoading] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [reverseData, setReverseData] = useState<{
    suburb?: string; city?: string; street?: string;
  }>({});

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    import("react-native-maps").then((mod) => {
      if (!cancelled) {
        setComponents({
          MapView: mod.default,
          Marker: mod.Marker,
          UrlTile: mod.UrlTile,
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const c = initialCoords ?? ALEX_COORDS;
    setMarkerCoords(c);
    setRegionCoords(c);
    setSearchQ("");
    setSearchResults([]);
    setDisplayName("");
    setReverseData({});
  }, [visible, initialCoords]);

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    const base = getApiBase();
    if (!base) return;
    setReverseLoading(true);
    try {
      const lang = isRTL ? "ar" : "en";
      const res = await fetch(`${base}/api/geo/reverse?lat=${lat}&lon=${lon}&lang=${lang}`);
      if (!res.ok) return;
      const json = await res.json();
      const r = json.result;
      if (r) {
        setDisplayName(r.display_name ?? "");
        setReverseData({
          suburb: r.address?.suburb ?? r.address?.neighbourhood,
          city: r.address?.city ?? r.address?.town,
          street: r.address?.road,
        });
      }
    } catch {
    } finally {
      setReverseLoading(false);
    }
  }, [isRTL]);

  const searchGeo = useCallback(async (q: string) => {
    const base = getApiBase();
    if (!base || q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const lang = isRTL ? "ar" : "en";
      const res = await fetch(
        `${base}/api/geo/search?q=${encodeURIComponent(q)}&lang=${lang}&limit=5`,
      );
      if (!res.ok) return;
      const json = await res.json();
      setSearchResults(json.results ?? []);
    } catch {
    } finally {
      setSearchLoading(false);
    }
  }, [isRTL]);

  const onSearchChange = (text: string) => {
    setSearchQ(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchGeo(text), 600);
  };

  const selectSearchResult = (r: SearchResult) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const coords = { latitude: lat, longitude: lon };
    setMarkerCoords(coords);
    setRegionCoords(coords);
    setDisplayName(r.display_name);
    setReverseData({
      suburb: r.address?.suburb,
      city: r.address?.city,
      street: r.address?.road,
    });
    setSearchQ("");
    setSearchResults([]);
    mapRef.current?.animateToRegion({ ...coords, ...DEFAULT_DELTA }, 500);
  };

  const onMarkerDragEnd = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoords({ latitude, longitude });
    await reverseGeocode(latitude, longitude);
  };

  const handleConfirm = () => {
    onConfirm({
      latitude: markerCoords.latitude,
      longitude: markerCoords.longitude,
      displayName,
      suburb: reverseData.suburb,
      city: reverseData.city,
      street: reverseData.street,
    });
  };

  const isWeb = Platform.OS === "web";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isRTL ? "تحديد الموقع" : "Pin Location"}
          </Text>
          <TouchableOpacity
            onPress={handleConfirm}
            style={[styles.headerBtn, styles.confirmBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="check" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQ}
            onChangeText={onSearchChange}
            placeholder={isRTL ? "ابحث عن عنوان..." : "Search address..."}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
          />
          {searchLoading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <View style={[styles.searchDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FlatList
              data={searchResults}
              keyExtractor={(r) => String(r.place_id)}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.searchItem, { borderBottomColor: colors.border }]}
                  onPress={() => selectSearchResult(item)}
                >
                  <Feather name="map-pin" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text
                    style={{ color: colors.foreground, fontSize: 13, flex: 1, textAlign: isRTL ? "right" : "left" }}
                    numberOfLines={2}
                  >
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map */}
        <View style={styles.mapWrap}>
          {isWeb ? (
            <View style={[styles.webFallback, { backgroundColor: colors.muted }]}>
              <Feather name="map" size={48} color={colors.border} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 14, textAlign: "center" }}>
                {isRTL ? "خريطة التفاعلية متاحة على التطبيق فقط" : "Interactive map is available on the mobile app"}
              </Text>
              {displayName ? (
                <Text style={{ color: colors.foreground, marginTop: 8, fontSize: 13, textAlign: "center", paddingHorizontal: 20 }}>
                  {displayName}
                </Text>
              ) : null}
            </View>
          ) : components ? (
            <components.MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{ ...regionCoords, ...DEFAULT_DELTA }}
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setMarkerCoords({ latitude, longitude });
                reverseGeocode(latitude, longitude);
              }}
            >
              <components.UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
              />
              <components.Marker
                coordinate={markerCoords}
                draggable
                onDragEnd={onMarkerDragEnd}
                pinColor="#F5A623"
              />
            </components.MapView>
          ) : (
            <View style={[styles.webFallback, { backgroundColor: colors.muted }]}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
        </View>

        {/* Bottom info bar */}
        <View style={[styles.infoBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.coordsRow}>
            <Feather name="navigation" size={14} color={colors.primary} />
            <Text style={[styles.coordsText, { color: colors.mutedForeground }]}>
              {markerCoords.latitude.toFixed(5)}, {markerCoords.longitude.toFixed(5)}
            </Text>
            {reverseLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 6 }} />}
          </View>
          {displayName ? (
            <Text
              style={[styles.displayName, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {displayName}
            </Text>
          ) : (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {isRTL ? "اسحب الدبوس لضبط الموقع بدقة" : "Drag the pin or tap to set exact location"}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.confirmBarBtn, { backgroundColor: colors.primary }]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmBarText}>
              {isRTL ? "تأكيد الموقع" : "Confirm Location"}
            </Text>
          </TouchableOpacity>
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
  confirmBtn: {},
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  searchDropdown: {
    position: "absolute",
    top: 110,
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 220,
    overflow: "hidden",
  },
  searchItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 8,
  },
  coordsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  coordsText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  displayName: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  confirmBarBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  confirmBarText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
