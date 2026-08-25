/**
 * Expo config plugin shim for react-native-webview.
 * Native autolinking handles the module; this avoids loading the package main
 * entry during `expo config` (Node ESM cannot resolve ./lib/WebView without .js).
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
module.exports = function withReactNativeWebView(config) {
  return config;
};
