import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, FlatList, ActivityIndicator, Platform,
} from "react-native";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const ALEX_COORDS = { latitude: 31.2001, longitude: 29.9187 };
const DEFAULT_DELTA = { latitudeDelta: 0.008, longitudeDelta: 0.008 };

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain) return "";
  const isLocal =
    domain.includes("192.168.") || domain.includes("10.") ||
    domain.includes("localhost") || domain.includes("127.0.0.1");
  return isLocal ? `http://${domain}` : `https://${domain}`;
}

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

type MapComponents = {
  MapView: typeof import("react-native-maps").default;
  Marker: typeof import("react-native-maps").Marker;
};

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface BilingualGeo {
  displayNameAr: string;
  displayNameEn: string;
  suburbAr?: string;
  suburbEn?: string;
  cityAr?: string;
  cityEn?: string;
  street?: string;
}

async function reverseGeocodeBilingual(lat: number, lon: number): Promise<BilingualGeo> {
  const base = getApiBase();
  const empty: BilingualGeo = { displayNameAr: "", displayNameEn: "" };

  try {
    if (base) {
      const res = await fetch(`${base}/api/geo/reverse?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const json = await res.json();
        const ar = (json.resultAr ?? {}) as Record<string, unknown>;
        const en = (json.resultEn ?? {}) as Record<string, unknown>;

        const addr   = (ar.address ?? {}) as Record<string, string>;
        const addrEn = (en.address ?? {}) as Record<string, string>;

        return {
          displayNameAr: (ar.display_name as string) ?? "",
          displayNameEn: (en.display_name as string) ?? "",
          suburbAr: addr.suburb ?? addr.neighbourhood ?? addr.quarter,
          suburbEn: addrEn.suburb ?? addrEn.neighbourhood ?? addrEn.quarter,
          cityAr:   addr.city ?? addr.town ?? addr.governorate,
          cityEn:   addrEn.city ?? addrEn.town ?? addrEn.governorate,
          street:   addrEn.road ?? addr.road,
        };
      }
    }
  } catch (e) {
    console.log("Local reverse geocoding failed, trying public fallback...", e);
  }

  try {
    const resAr = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ar`, {
      headers: { "User-Agent": "FanniApp-Egypt/1.0" }
    });
    const resEn = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`, {
      headers: { "User-Agent": "FanniApp-Egypt/1.0" }
    });

    if (resAr.ok) {
      const jsonAr = await resAr.json();
      const jsonEn = resEn.ok ? await resEn.json() : jsonAr;

      const addrAr = (jsonAr.address ?? {}) as Record<string, string>;
      const addrEn = (jsonEn.address ?? {}) as Record<string, string>;

      return {
        displayNameAr: (jsonAr.display_name as string) ?? "",
        displayNameEn: (jsonEn.display_name as string) ?? "",
        suburbAr: addrAr.suburb ?? addrAr.neighbourhood ?? addrAr.quarter ?? addrAr.city_district,
        suburbEn: addrEn.suburb ?? addrEn.neighbourhood ?? addrEn.quarter ?? addrEn.city_district,
        cityAr:   addrAr.city ?? addrAr.town ?? addrAr.governorate,
        cityEn:   addrEn.city ?? addrEn.town ?? addrEn.governorate,
        street:   addrAr.road ?? addrEn.road ?? "",
      };
    }
  } catch (err) {
    console.log("Public fallback reverse geocode failed", err);
  }

  return empty;
}

export default function MapPickerModal({
  visible, initialCoords, onConfirm, onClose,
}: MapPickerModalProps) {
  const colors = useColors();
  const { isRTL } = useApp();

  const [components, setComponents] = useState<MapComponents | null>(null);
  const mapRef = useRef<import("react-native-maps").default | null>(null);

  const [markerCoords, setMarkerCoords] = useState(initialCoords ?? ALEX_COORDS);
  const [regionCoords, setRegionCoords] = useState(initialCoords ?? ALEX_COORDS);
  const [geoData, setGeoData] = useState<BilingualGeo | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [locPermissionLoading, setLocPermissionLoading] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    import("react-native-maps").then((mod) => {
      if (!cancelled) {
        setComponents({ MapView: mod.default, Marker: mod.Marker });
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
    setGeoData(null);
  }, [visible]);

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    setReverseLoading(true);
    try {
      const data = await reverseGeocodeBilingual(lat, lon);
      setGeoData(data);
    } finally {
      setReverseLoading(false);
    }
  }, []);

  // جلب موقع الهاتف الحالي عبر صلاحيات GPS
  const handleMyLocationPress = async () => {
    setLocPermissionLoading(true);
    try {
      // تحميل مكتبة تحديد الموقع التابعة لإكسبو ديناميكياً لتجنب المشاكل البرمجية
      const Location = require("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert(isRTL ? "مطلوب صلاحية تحديد الموقع للعمل" : "Location permission is required");
        return;
      }
      const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: currentLoc.coords.latitude, longitude: currentLoc.coords.longitude };
      
      setMarkerCoords(coords);
      mapRef.current?.animateToRegion({ ...coords, ...DEFAULT_DELTA }, 600);
      await reverseGeocode(coords.latitude, coords.longitude);
    } catch (e) {
      console.log("Error getting location", e);
    } finally {
      setLocPermissionLoading(false);
    }
  };

  const searchGeo = useCallback(async (q: string) => {
    const base = getApiBase();
    if (!base || q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const lang = isRTL ? "ar" : "en";
      const res = await fetch(`${base}/api/geo/search?q=${encodeURIComponent(q)}&lang=${lang}&limit=5`);
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

  const selectSearchResult = async (r: SearchResult) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const coords = { latitude: lat, longitude: lon };
    setMarkerCoords(coords);
    setRegionCoords(coords);
    setSearchQ("");
    setSearchResults([]);
    mapRef.current?.animateToRegion({ ...coords, ...DEFAULT_DELTA }, 500);
    await reverseGeocode(lat, lon);
  };

  const onMarkerDragEnd = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoords({ latitude, longitude });
    await reverseGeocode(latitude, longitude);
  };

  const handleMapPress = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoords({ latitude, longitude });
    await reverseGeocode(latitude, longitude);
  };

  const handleConfirm = () => {
    onConfirm({
      latitude: markerCoords.latitude,
      longitude: markerCoords.longitude,
      displayNameAr: geoData?.displayNameAr,
      displayNameEn: geoData?.displayNameEn,
      suburbAr: geoData?.suburbAr,
      suburbEn: geoData?.suburbEn,
      cityAr:   geoData?.cityAr,
      cityEn:   geoData?.cityEn,
      street:   geoData?.street,
    });
  };

  const displayName = isRTL ? (geoData?.displayNameAr ?? "") : (geoData?.displayNameEn ?? "");
  const isWeb = Platform.OS === "web";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
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

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <VectorIcon name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQ}
            onChangeText={onSearchChange}
            placeholder={isRTL ? "ابحث عن عنوان..." : "Search address..."}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
          />
          {searchLoading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Search results */}
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
                  <VectorIcon name="map-pin" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.foreground, fontSize: 13, flex: 1, textAlign: isRTL ? "right" : "left" }} numberOfLines={2}>
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
              <VectorIcon name="map" size={48} color={colors.border} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 14, textAlign: "center" }}>
                {isRTL ? "الخريطة التفاعلية متاحة على تطبيق الهاتف فقط" : "Interactive map is available on the mobile app"}
              </Text>
            </View>
          ) : components ? (
            <View style={{ flex: 1 }}>
              <components.MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{ ...regionCoords, ...DEFAULT_DELTA }}
                onPress={handleMapPress}
              >
                <components.Marker
                  coordinate={markerCoords}
                  draggable
                  onDragEnd={onMarkerDragEnd}
                  pinColor="#F5A623"
                  tracksViewChanges={false} // تسريع حركة الدبوس بشكل هائل
                />
              </components.MapView>

              {/* زر تحديد الموقع الحالي الذهبي العائم */}
              <TouchableOpacity
                style={[styles.myLocBtn, { borderColor: colors.primary, backgroundColor: colors.card }]}
                onPress={handleMyLocationPress}
                activeOpacity={0.8}
              >
                {locPermissionLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <VectorIcon name="navigation" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.webFallback, { backgroundColor: colors.muted }]}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
        </View>

        {/* Bottom info bar */}
        <View style={[styles.infoBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.coordsRow}>
            <VectorIcon name="navigation" size={14} color={colors.primary} />
            <Text style={[styles.coordsText, { color: colors.mutedForeground }]}>
              {markerCoords.latitude.toFixed(5)}, {markerCoords.longitude.toFixed(5)}
            </Text>
            {reverseLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 6 }} />}
          </View>
          {displayName ? (
            <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={2}>
              {displayName}
            </Text>
          ) : (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              {isRTL ? "اسحب الدبوس أو انقر على الخريطة لتحديد الموقع" : "Drag the pin or tap to set exact location"}
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
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    borderRadius: 10,
  },
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
  webFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  myLocBtn: {
    position: "absolute",
    bottom: 24,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2, // الحلقة الذهبية
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  confirmBarText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});