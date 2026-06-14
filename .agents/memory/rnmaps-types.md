---
name: react-native-maps correct prop types
description: The Map-prefixed type names are correct; bare names like MarkerProps are wrong.
---

Correct type names from `react-native-maps`:
- `MapMarkerProps` (not `MarkerProps`)
- `MapPolylineProps` (not `PolylineProps`)
- `MapUrlTileProps` (not `UrlTileProps`)
- `MapCircleProps` (not `CircleProps`)
- `MapViewProps` — unchanged

**Why:** The library re-exports component-level types with the `Map` prefix to avoid name collisions.
