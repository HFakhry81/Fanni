/**
 * Multi-marker / polyline OSM map via Leaflet WebView (no Google API key).
 */
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export type OsmMarker = {
  id: string;
  latitude: number;
  longitude: number;
  color?: string;
  label?: string;
};

export type OsmPolyline = {
  id: string;
  color: string;
  coords: Array<{ latitude: number; longitude: number }>;
};

type Props = {
  style?: StyleProp<ViewStyle>;
  markers: OsmMarker[];
  polylines?: OsmPolyline[];
  circles?: Array<{ latitude: number; longitude: number; radiusM: number; color?: string }>;
  initialCenter?: { latitude: number; longitude: number };
  initialZoom?: number;
  fitMarkers?: boolean;
  onMarkerPress?: (id: string) => void;
};

function buildHtml(
  markers: OsmMarker[],
  polylines: OsmPolyline[],
  circles: NonNullable<Props["circles"]>,
  center: { latitude: number; longitude: number },
  zoom: number,
  fitMarkers: boolean
): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#EEF3FA}
  .leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.85)!important;border-radius:8px 0 0 0}
  .dot{width:28px;height:28px;border-radius:14px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;color:#fff;font:700 11px/1 sans-serif}
</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:false,inertia:true}).setView([${center.latitude},${center.longitude}],${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
  var layerGroup = L.layerGroup().addTo(map);

  function post(type, id){
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:type,id:id||''}));
  }

  function render(payload){
    layerGroup.clearLayers();
    var markers = payload.markers || [];
    var polylines = payload.polylines || [];
    var circles = payload.circles || [];
    var bounds = [];

    polylines.forEach(function(pl){
      var latlngs = (pl.coords||[]).map(function(c){ return [c.latitude,c.longitude]; });
      if (latlngs.length < 2) return;
      L.polyline(latlngs,{color:pl.color||'#1565C0',weight:4,opacity:0.9}).addTo(layerGroup);
      latlngs.forEach(function(ll){ bounds.push(ll); });
    });

    circles.forEach(function(c){
      L.circle([c.latitude,c.longitude],{
        radius:c.radiusM||5000,
        color:c.color||'#3B82F6',
        fillColor:c.color||'#3B82F6',
        fillOpacity:0.12,
        weight:2
      }).addTo(layerGroup);
    });

    markers.forEach(function(m){
      var color = m.color || '#F5A623';
      var label = (m.label || '').slice(0,2);
      var icon = L.divIcon({
        className:'',
        html:'<div class="dot" style="background:'+color+'">'+label+'</div>',
        iconSize:[28,28],
        iconAnchor:[14,14]
      });
      var mk = L.marker([m.latitude,m.longitude],{icon:icon}).addTo(layerGroup);
      mk.on('click', function(){ post('marker', m.id); });
      bounds.push([m.latitude,m.longitude]);
    });

    if (payload.fit && bounds.length > 0) {
      map.fitBounds(bounds, { padding:[48,48], maxZoom:16, animate:true });
    }
  }

  window.__updateMap = function(json){
    try { render(typeof json === 'string' ? JSON.parse(json) : json); } catch(e) {}
  };

  render({
    markers: ${JSON.stringify(markers)},
    polylines: ${JSON.stringify(polylines)},
    circles: ${JSON.stringify(circles)},
    fit: ${fitMarkers ? "true" : "false"}
  });
  post('ready');
</script></body></html>`;
}

export default function OsmMultiMap({
  style,
  markers,
  polylines = [],
  circles = [],
  initialCenter,
  initialZoom = 12,
  fitMarkers = true,
  onMarkerPress,
}: Props) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  const center = initialCenter ?? markers[0] ?? { latitude: 31.2, longitude: 29.92 };

  const html = useMemo(
    () =>
      buildHtml(
        markers,
        polylines,
        circles,
        { latitude: center.latitude, longitude: center.longitude },
        initialZoom,
        fitMarkers
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!readyRef.current) return;
    const payload = JSON.stringify({
      markers,
      polylines,
      circles,
      fit: fitMarkers,
    });
    webRef.current?.injectJavaScript(
      `window.__updateMap && window.__updateMap(${JSON.stringify(payload)}); true;`
    );
  }, [markers, polylines, circles, fitMarkers]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { type: string; id?: string };
      if (data.type === "ready") {
        readyRef.current = true;
        return;
      }
      if (data.type === "marker" && data.id) onMarkerPress?.(data.id);
    } catch {
      // ignore
    }
  };

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
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
});
