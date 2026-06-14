---
name: Metro web stub for react-native-maps
description: How to prevent react-native-maps (and other native-only libs) from crashing the Expo web bundle
---

## The Rule
`react-native-maps` crashes the Metro web bundler because it imports `react-native/Libraries/Utilities/codegenNativeCommands`, a native-only internal. `.web.tsx` component stubs are NOT sufficient — Metro still bundles the native `.tsx` file if another non-stubbed component imports it.

**Why:** Metro resolves `.web.tsx` extension overrides at the file level, but static `import "react-native-maps"` inside a `.tsx` file that IS bundled for web still pulls in the native module.

**How to apply:** Add a custom `resolveRequest` to `metro.config.js` that intercepts the module name `"react-native-maps"` when `platform === "web"` and returns a thin JS stub (`web-stubs/react-native-maps.js`). This is the only 100%-reliable fix regardless of how or from where the lib is imported.

```js
// metro.config.js
const WEB_STUB = path.resolve(__dirname, "web-stubs/react-native-maps.js");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return { filePath: WEB_STUB, type: "sourceFile" };
  }
  // fall through ...
};
```

The stub exports no-op functions for default, Marker, Polyline, Circle, UrlTile, Callout, MapView, and null for PROVIDER_* constants.
