import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VectorIcon from "@/components/VectorIcon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { getApiBase } from "@/utils/api";
import OsmMapView, { type OsmMapViewHandle } from "@/components/OsmMapView";

const ALEX_COORDS = { latitude: 31.2001, longitude: 29.9187 };
const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_COLLAPSED = 168;
const SHEET_EXPANDED = Math.min(320, SCREEN_H * 0.42);

export interface PickedLocation {
  latitude: number;
  longitude: number;
  displayNameAr?: string;
  displayNameEn?: string;
  suburbAr?: string;
  suburbEn?: string;
  cityAr?: string;
  cityEn?: string;
  stateAr?: string;
  stateEn?: string;
  street?: string;
}

interface MapPickerModalProps {
  visible: boolean;
  initialCoords?: { latitude: number; longitude: number } | null;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
}

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
  stateAr?: string;
  stateEn?: string;
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
        const addr = (ar.address ?? {}) as Record<string, string>;
        const addrEn = (en.address ?? {}) as Record<string, string>;
        return {
          displayNameAr: (ar.display_name as string) ?? "",
          displayNameEn: (en.display_name as string) ?? "",
          suburbAr: addr.suburb ?? addr.neighbourhood ?? addr.quarter,
          suburbEn: addrEn.suburb ?? addrEn.neighbourhood ?? addrEn.quarter,
          cityAr: addr.city ?? addr.town,
          cityEn: addrEn.city ?? addrEn.town,
          stateAr: addr.state ?? addr.governorate,
          stateEn: addrEn.state ?? addrEn.governorate,
          street: addrEn.road ?? addr.road,
        };
      }
    }
  } catch (e) {
    console.log("Local reverse geocoding failed, trying public fallback...", e);
  }

  try {
    const resAr = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ar`,
      { headers: { "User-Agent": "FanniApp-Egypt/1.0" } }
    );
    const resEn = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`,
      { headers: { "User-Agent": "FanniApp-Egypt/1.0" } }
    );
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
        cityAr: addrAr.city ?? addrAr.town,
        cityEn: addrEn.city ?? addrEn.town,
        stateAr: addrAr.state ?? addrAr.governorate,
        stateEn: addrEn.state ?? addrEn.governorate,
        street: addrAr.road ?? addrEn.road ?? "",
      };
    }
  } catch (err) {
    console.log("Public fallback reverse geocode failed", err);
  }

  return empty;
}

export default function MapPickerModal({
  visible,
  initialCoords,
  onConfirm,
  onClose,
}: MapPickerModalProps) {
  const colors = useColors();
  const { isRTL } = useApp();
  const insets = useSafeAreaInsets();

  const mapHandle = useRef<OsmMapViewHandle | null>(null);
  const [mapKey, setMapKey] = useState(0);

  const [markerCoords, setMarkerCoords] = useState(initialCoords ?? ALEX_COORDS);
  const [geoData, setGeoData] = useState<BilingualGeo | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [locPermissionLoading, setLocPermissionLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sheetHeight = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const pinHintOpacity = useRef(new Animated.Value(1)).current;
  const sheetDragStart = useRef(SHEET_COLLAPSED);

  const collapsedH = SHEET_COLLAPSED + Math.max(insets.bottom, 8);
  const expandedH = SHEET_EXPANDED + Math.max(insets.bottom, 8);

  const snapSheet = useCallback(
    (expand: boolean) => {
      setSheetExpanded(expand);
      Animated.spring(sheetHeight, {
        toValue: expand ? expandedH : collapsedH,
        useNativeDriver: false,
        friction: 9,
        tension: 64,
      }).start();
    },
    [collapsedH, expandedH, sheetHeight]
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        sheetHeight.stopAnimation((v) => {
          sheetDragStart.current = typeof v === "number" ? v : collapsedH;
        });
      },
      onPanResponderMove: (_, g) => {
        const next = Math.min(
          expandedH,
          Math.max(collapsedH, sheetDragStart.current - g.dy)
        );
        sheetHeight.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const mid = (collapsedH + expandedH) / 2;
        sheetHeight.stopAnimation((v) => {
          const current = typeof v === "number" ? v : collapsedH;
          const shouldExpand =
            g.vy < -0.4 || (g.vy <= 0.4 && current > mid);
          snapSheet(shouldExpand);
        });
      },
    })
  ).current;

  const initialLat = initialCoords?.latitude;
  const initialLng = initialCoords?.longitude;
  const wasVisible = useRef(false);

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    setReverseLoading(true);
    try {
      const data = await reverseGeocodeBilingual(lat, lon);
      setGeoData(data);
    } finally {
      setReverseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    // Remount map only when the modal opens — not on every parent re-render
    if (wasVisible.current) return;
    wasVisible.current = true;

    const c =
      initialLat != null && initialLng != null
        ? { latitude: initialLat, longitude: initialLng }
        : ALEX_COORDS;
    setMarkerCoords(c);
    setSearchQ("");
    setSearchResults([]);
    setGeoData(null);
    setDragging(false);
    setSheetExpanded(false);
    sheetHeight.setValue(collapsedH);
    setMapKey((k) => k + 1);
    pinHintOpacity.setValue(1);
    Animated.sequence([
      Animated.delay(2200),
      Animated.timing(pinHintOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
    void reverseGeocode(c.latitude, c.longitude);
    // collapsedH / sheetHeight / pinHintOpacity intentionally omitted — open once per visible=true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialLat, initialLng, reverseGeocode]);

  const handleMyLocationPress = async () => {
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.88, duration: 90, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    setLocPermissionLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert(isRTL ? "مطلوب صلاحية تحديد الموقع للعمل" : "Location permission is required");
        return;
      }
      const currentLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: currentLoc.coords.latitude,
        longitude: currentLoc.coords.longitude,
      };
      setMarkerCoords(coords);
      mapHandle.current?.animateTo(coords, 18);
      await reverseGeocode(coords.latitude, coords.longitude);
      snapSheet(true);
    } catch (e) {
      console.log("Error getting location", e);
    } finally {
      setLocPermissionLoading(false);
    }
  };

  const searchGeo = useCallback(
    async (q: string) => {
      const base = getApiBase();
      if (!base || q.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const lang = isRTL ? "ar" : "en";
        const res = await fetch(
          `${base}/api/geo/search?q=${encodeURIComponent(q)}&lang=${lang}&limit=5`
        );
        if (!res.ok) return;
        const json = await res.json();
        setSearchResults(json.results ?? []);
      } catch {
        // ignore
      } finally {
        setSearchLoading(false);
      }
    },
    [isRTL]
  );

  const onSearchChange = (text: string) => {
    setSearchQ(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchGeo(text), 500);
  };

  const selectSearchResult = async (r: SearchResult) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const coords = { latitude: lat, longitude: lon };
    setMarkerCoords(coords);
    setSearchQ("");
    setSearchResults([]);
    mapHandle.current?.animateTo(coords, 17);
    await reverseGeocode(lat, lon);
    snapSheet(true);
  };

  const onMarkerDragStart = () => {
    setDragging(true);
    setGeoData(null);
  };

  // Mid-drag: do not push coords into markerCoords (would fight Leaflet via __setMarker)
  const onMarkerDrag = (_coords: { latitude: number; longitude: number }) => {
    // intentionally no-op — final position applied on dragend
  };

  const onMarkerDragEnd = async (coords: { latitude: number; longitude: number }) => {
    setDragging(false);
    setMarkerCoords(coords);
    await reverseGeocode(coords.latitude, coords.longitude);
    snapSheet(true);
  };

  const handleMapPress = async (coords: { latitude: number; longitude: number }) => {
    setMarkerCoords(coords);
    await reverseGeocode(coords.latitude, coords.longitude);
    snapSheet(true);
  };

  const handleConfirm = () => {
    onConfirm({
      latitude: markerCoords.latitude,
      longitude: markerCoords.longitude,
      displayNameAr: geoData?.displayNameAr,
      displayNameEn: geoData?.displayNameEn,
      suburbAr: geoData?.suburbAr,
      suburbEn: geoData?.suburbEn,
      cityAr: geoData?.cityAr,
      cityEn: geoData?.cityEn,
      stateAr: geoData?.stateAr,
      stateEn: geoData?.stateEn,
      street: geoData?.street,
    });
  };

  const displayName = isRTL
    ? (geoData?.displayNameAr ?? "")
    : (geoData?.displayNameEn ?? "");
  const streetLine =
    geoData?.street ||
    (displayName ? displayName.split(",")[0]?.trim() : "") ||
    "";

  const fabBottom = Animated.add(sheetHeight, 16);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Full-bleed map */}
        <View style={styles.mapWrap}>
          {visible ? (
            <OsmMapView
              key={mapKey}
              mapRef={mapHandle}
              style={styles.map}
              initialCoords={markerCoords}
              markerCoords={markerCoords}
              zoom={16}
              bottomPadding={collapsedH + 24}
              pinColor={colors.primary}
              onMapPress={handleMapPress}
              onMarkerDragStart={onMarkerDragStart}
              onMarkerDrag={onMarkerDrag}
              onMarkerDragEnd={onMarkerDragEnd}
            />
          ) : null}

          {/* Center focus ring hint */}
          <Animated.View
            pointerEvents="none"
            style={[styles.focusHint, { opacity: pinHintOpacity }]}
          >
            <View style={[styles.focusRing, { borderColor: colors.primary + "55" }]} />
            <Text style={[styles.focusHintText, { color: colors.dark, backgroundColor: "#FFFFFFEE" }]}>
              {isRTL ? "اسحب الدبوس أو انقر على الخريطة" : "Drag the pin or tap the map"}
            </Text>
          </Animated.View>
        </View>

        {/* Floating top chrome */}
        <View
          style={[
            styles.topChrome,
            { paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 12) + 6 },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.chromeBtn, { backgroundColor: colors.card }]}
              activeOpacity={0.85}
            >
              <VectorIcon name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>

            <View style={[styles.titlePill, { backgroundColor: colors.dark }]}>
              <VectorIcon name="map-pin" size={14} color={colors.primary} />
              <Text style={styles.titlePillText}>
                {isRTL ? "تحديد الموقع" : "Pin location"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleConfirm}
              style={[styles.chromeBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <VectorIcon name="check" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                flexDirection: isRTL ? "row-reverse" : "row",
              },
            ]}
          >
            <VectorIcon name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={searchQ}
              onChangeText={onSearchChange}
              placeholder={isRTL ? "ابحث عن شارع أو منطقة..." : "Search street or area..."}
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.searchInput,
                { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
              ]}
            />
            {searchLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : searchQ.length > 0 ? (
              <TouchableOpacity onPress={() => { setSearchQ(""); setSearchResults([]); }}>
                <VectorIcon name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>

          {searchResults.length > 0 && (
            <View style={[styles.searchDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FlatList
                data={searchResults}
                keyExtractor={(r) => String(r.place_id)}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.searchItem,
                      {
                        borderBottomColor: colors.border,
                        flexDirection: isRTL ? "row-reverse" : "row",
                      },
                    ]}
                    onPress={() => selectSearchResult(item)}
                  >
                    <View style={[styles.searchIconWrap, { backgroundColor: colors.accent }]}>
                      <VectorIcon name="map-pin" size={14} color={colors.primary} />
                    </View>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 13,
                        flex: 1,
                        textAlign: isRTL ? "right" : "left",
                        fontFamily: "Inter_500Medium",
                        lineHeight: 18,
                      }}
                      numberOfLines={2}
                    >
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* My location FAB — tracks sheet height (JS driver) + scale (native) on separate nodes */}
        <Animated.View
          style={[
            styles.fabWrap,
            {
              bottom: fabBottom,
              [isRTL ? "left" : "right"]: 16,
            },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: fabScale }], alignItems: "center" }}>
            <TouchableOpacity
              style={[
                styles.myLocBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                },
              ]}
              onPress={handleMyLocationPress}
              activeOpacity={0.85}
            >
              {locPermissionLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <VectorIcon name="navigation" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
            <Text style={[styles.fabLabel, { color: colors.dark }]}>
              {isRTL ? "موقعي" : "My location"}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Draggable address sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => snapSheet(!sheetExpanded)}
            style={styles.sheetHandleHit}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          </TouchableOpacity>

          <View style={[styles.sheetHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <View
              style={[
                styles.sheetStatusDot,
                {
                  backgroundColor: dragging
                    ? colors.secondary
                    : reverseLoading
                      ? colors.mutedForeground
                      : colors.success,
                },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.sheetEyebrow,
                  { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
                ]}
              >
                {dragging
                  ? isRTL
                    ? "جاري تحريك الدبوس..."
                    : "Moving pin..."
                  : reverseLoading
                    ? isRTL
                      ? "جاري قراءة العنوان..."
                      : "Reading address..."
                    : isRTL
                      ? "العنوان المحدد"
                      : "Selected address"}
              </Text>
              <Text
                style={[
                  styles.sheetTitle,
                  { color: colors.foreground, textAlign: isRTL ? "right" : "left" },
                ]}
                numberOfLines={sheetExpanded ? 3 : 2}
              >
                {dragging
                  ? isRTL
                    ? "أفلت الدبوس لتثبيت الموقع"
                    : "Release to drop the pin"
                  : streetLine || displayName || (isRTL ? "حرّك الدبوس فوق موقعك" : "Move the pin to your spot")}
              </Text>
            </View>
            {(reverseLoading || dragging) && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 6 }} />
            )}
          </View>

          {sheetExpanded && (
            <View style={styles.sheetDetails}>
              {displayName && streetLine !== displayName ? (
                <Text
                  style={[
                    styles.sheetSub,
                    { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" },
                  ]}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>
              ) : null}
              <View
                style={[
                  styles.coordsChip,
                  {
                    backgroundColor: colors.navyGhost,
                    alignSelf: isRTL ? "flex-end" : "flex-start",
                  },
                ]}
              >
                <VectorIcon name="navigation" size={12} color={colors.secondary} />
                <Text style={[styles.coordsText, { color: colors.darkMid }]}>
                  {markerCoords.latitude.toFixed(5)}, {markerCoords.longitude.toFixed(5)}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.confirmBarBtn,
              {
                backgroundColor: colors.primary,
                opacity: dragging ? 0.55 : 1,
              },
            ]}
            onPress={handleConfirm}
            disabled={dragging}
            activeOpacity={0.9}
          >
            <VectorIcon name="check" size={18} color="#fff" />
            <Text style={styles.confirmBarText}>
              {isRTL ? "تأكيد هذا الموقع" : "Confirm this location"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { ...StyleSheet.absoluteFillObject },
  map: { flex: 1 },
  focusHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  focusRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: Platform.OS === "ios" ? "dashed" : "solid",
    opacity: 0.9,
  },
  focusHintText: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: "hidden",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  topChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 14,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chromeBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D1B2A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  titlePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  titlePillText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  searchBar: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#0D1B2A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  searchDropdown: {
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: 220,
    overflow: "hidden",
    shadowColor: "#0D1B2A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  searchItem: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fabWrap: {
    position: "absolute",
    zIndex: 25,
    alignItems: "center",
    gap: 4,
  },
  myLocBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D1B2A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 7,
  },
  fabLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    backgroundColor: "#FFFFFFDD",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    shadowColor: "#0D1B2A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandleHit: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
  },
  sheetHeader: {
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  sheetStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 7,
  },
  sheetEyebrow: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  sheetTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  sheetDetails: {
    gap: 8,
    marginBottom: 12,
  },
  sheetSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  coordsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  coordsText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  confirmBarBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
            marginTop: 8,
          },
          confirmBarText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
