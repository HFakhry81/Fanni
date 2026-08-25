/**
 * Free OpenStreetMap picker via Leaflet in a WebView.
 * Smooth pan/zoom, branded draggable pin, auto-focus on pin area.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export type MapCoords = { latitude: number; longitude: number };

export type OsmMapViewHandle = {
  animateTo: (coords: MapCoords, zoom?: number) => void;
  setMarker: (coords: MapCoords, animate?: boolean) => void;
};

type Props = {
  style?: StyleProp<ViewStyle>;
  initialCoords: MapCoords;
  markerCoords: MapCoords;
  zoom?: number;
  /** Extra bottom padding (px) so the pin stays above the address sheet */
  bottomPadding?: number;
  pinColor?: string;
  onMapPress?: (coords: MapCoords) => void;
  onMarkerDragStart?: () => void;
  onMarkerDrag?: (coords: MapCoords) => void;
  onMarkerDragEnd?: (coords: MapCoords) => void;
  mapRef?: React.MutableRefObject<OsmMapViewHandle | null>;
};

function buildHtml(
  lat: number,
  lon: number,
  zoom: number,
  bottomPadding: number,
  pinColor: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #EEF3FA; touch-action: none; }
    .leaflet-control-attribution {
      font-size: 9px; background: rgba(255,255,255,0.82) !important;
      border-radius: 8px 0 0 0; padding: 2px 8px !important; margin: 0 !important;
    }
    .leaflet-control-zoom { display: none !important; }
    .fanni-pin-wrap {
      position: relative; width: 44px; height: 56px;
      margin-left: -22px; margin-top: -56px;
      transition: transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1);
      will-change: transform;
    }
    .fanni-pin-wrap.dragging {
      transform: translateY(-14px) scale(1.12);
      filter: drop-shadow(0 10px 14px rgba(13,27,42,0.35));
    }
    .fanni-pin-wrap.settling {
      animation: pinDrop 0.38s cubic-bezier(0.34, 1.4, 0.64, 1);
    }
    @keyframes pinDrop {
      0% { transform: translateY(-18px) scale(1.1); }
      60% { transform: translateY(3px) scale(0.96); }
      100% { transform: translateY(0) scale(1); }
    }
    .fanni-pin-head {
      width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
      background: ${pinColor};
      transform: rotate(-45deg);
      position: absolute; left: 4px; top: 2px;
      border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(13,27,42,0.28);
    }
    .fanni-pin-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #fff; position: absolute;
      left: 17px; top: 14px; z-index: 2;
    }
    .fanni-pin-shadow {
      position: absolute; left: 10px; bottom: 2px;
      width: 24px; height: 8px; border-radius: 50%;
      background: rgba(13,27,42,0.28);
      transition: transform 0.18s ease, opacity 0.18s ease;
    }
    .fanni-pin-wrap.dragging .fanni-pin-shadow {
      transform: scale(1.35); opacity: 0.45;
    }
    .fanni-pulse {
      position: absolute; left: 6px; bottom: -2px;
      width: 32px; height: 32px; border-radius: 50%;
      border: 2px solid ${pinColor};
      opacity: 0; pointer-events: none;
    }
    .fanni-pin-wrap.pulse .fanni-pulse {
      animation: pulseRing 1.1s ease-out;
    }
    @keyframes pulseRing {
      0% { transform: scale(0.4); opacity: 0.55; }
      100% { transform: scale(2.2); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var PIN_HTML =
      '<div class="fanni-pin-wrap" id="fanniPin">' +
        '<div class="fanni-pulse"></div>' +
        '<div class="fanni-pin-shadow"></div>' +
        '<div class="fanni-pin-head"></div>' +
        '<div class="fanni-pin-dot"></div>' +
      '</div>';

    var pinIcon = L.divIcon({
      className: '',
      html: PIN_HTML,
      iconSize: [44, 56],
      iconAnchor: [22, 56]
    });

    var map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      inertia: true,
      inertiaDeceleration: 2800,
      inertiaMaxSpeed: 2200,
      easeLinearity: 0.2,
      zoomAnimation: true,
      markerZoomAnimation: true,
      fadeAnimation: true,
      wheelPxPerZoomLevel: 80
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var bottomPad = ${bottomPadding};
    map.setView([${lat}, ${lon}], ${zoom}, { animate: false });
    if (bottomPad > 0) {
      map.panBy([0, -bottomPad * 0.28], { animate: false });
    }

    var marker = L.marker([${lat}, ${lon}], {
      icon: pinIcon,
      draggable: true,
      autoPan: true,
      autoPanPadding: [56, 56],
      autoPanSpeed: 14,
      riseOnHover: true
    }).addTo(map);

    function pinEl() {
      return document.getElementById('fanniPin');
    }

    function setDragging(on) {
      var el = pinEl();
      if (!el) return;
      el.classList.toggle('dragging', !!on);
    }

    function pulsePin() {
      var el = pinEl();
      if (!el) return;
      el.classList.remove('pulse', 'settling');
      void el.offsetWidth;
      el.classList.add('pulse', 'settling');
      setTimeout(function () {
        el.classList.remove('settling');
      }, 400);
    }

    function post(type, lat, lon) {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: type, latitude: lat, longitude: lon
      }));
    }

    /** Offset view so the pin sits in the clear area above the address sheet */
    function focusPin(lat, lon, z, duration) {
      var targetZoom = z || map.getZoom();
      var offsetY = Math.max(0, (bottomPad || 0) * 0.38);
      var point = map.project([lat, lon], targetZoom);
      point.y += offsetY;
      var center = map.unproject(point, targetZoom);
      map.flyTo(center, targetZoom, {
        animate: true,
        duration: duration == null ? 0.75 : duration,
        easeLinearity: 0.25
      });
    }

    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      pulsePin();
      focusPin(e.latlng.lat, e.latlng.lng, Math.max(map.getZoom(), 17), 0.55);
      post('press', e.latlng.lat, e.latlng.lng);
    });

    marker.on('dragstart', function () {
      setDragging(true);
      post('dragstart', marker.getLatLng().lat, marker.getLatLng().lng);
    });

    marker.on('drag', function () {
      var p = marker.getLatLng();
      post('drag', p.lat, p.lng);
    });

    marker.on('dragend', function () {
      setDragging(false);
      var p = marker.getLatLng();
      pulsePin();
      focusPin(p.lat, p.lng, Math.max(map.getZoom(), 17), 0.65);
      post('dragend', p.lat, p.lng);
    });

    window.__setMarker = function (lat, lon, animate) {
      marker.setLatLng([lat, lon]);
      if (animate) {
        pulsePin();
        focusPin(lat, lon, Math.max(map.getZoom(), 16), 0.7);
      }
    };

    window.__animateTo = function (lat, lon, z) {
      marker.setLatLng([lat, lon]);
      pulsePin();
      focusPin(lat, lon, z || 17, 0.9);
    };

    window.__setBottomPadding = function (px) {
      bottomPad = px || 0;
      var p = marker.getLatLng();
      focusPin(p.lat, p.lng, map.getZoom(), 0.4);
    };

    setTimeout(function () { pulsePin(); }, 280);
    post('ready', ${lat}, ${lon});
  </script>
</body>
</html>`;
}

export default function OsmMapView({
  style,
  initialCoords,
  markerCoords,
  zoom = 16,
  bottomPadding = 0,
  pinColor = "#F5A623",
  onMapPress,
  onMarkerDragStart,
  onMarkerDrag,
  onMarkerDragEnd,
  mapRef,
}: Props) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const skipNextSync = useRef(false);

  const html = useMemo(
    () =>
      buildHtml(
        initialCoords.latitude,
        initialCoords.longitude,
        zoom,
        bottomPadding,
        pinColor
      ),
    // Seed once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const run = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`${js}; true;`);
  }, []);

  useEffect(() => {
    if (!mapRef) return;
    mapRef.current = {
      animateTo: (coords, z = zoom) => {
        skipNextSync.current = true;
        run(
          `window.__animateTo && window.__animateTo(${coords.latitude}, ${coords.longitude}, ${z})`
        );
      },
      setMarker: (coords, animate = false) => {
        skipNextSync.current = true;
        run(
          `window.__setMarker && window.__setMarker(${coords.latitude}, ${coords.longitude}, ${animate ? "true" : "false"})`
        );
      },
    };
    return () => {
      mapRef.current = null;
    };
  }, [mapRef, run, zoom]);

  useEffect(() => {
    if (!readyRef.current) return;
    run(`window.__setBottomPadding && window.__setBottomPadding(${bottomPadding})`);
  }, [bottomPadding, run]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    run(
      `window.__setMarker && window.__setMarker(${markerCoords.latitude}, ${markerCoords.longitude}, false)`
    );
  }, [markerCoords.latitude, markerCoords.longitude, run]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data) as {
          type: string;
          latitude: number;
          longitude: number;
        };
        const coords = { latitude: data.latitude, longitude: data.longitude };
        if (data.type === "ready") {
          readyRef.current = true;
          return;
        }
        if (data.type === "dragstart") {
          onMarkerDragStart?.();
          return;
        }
        if (data.type === "drag") {
          onMarkerDrag?.(coords);
          return;
        }
        if (data.type === "press") {
          skipNextSync.current = true;
          onMapPress?.(coords);
          return;
        }
        if (data.type === "dragend") {
          skipNextSync.current = true;
          onMarkerDragEnd?.(coords);
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onMapPress, onMarkerDragStart, onMarkerDrag, onMarkerDragEnd]
  );

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        overScrollMode="never"
        bounces={false}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
});
