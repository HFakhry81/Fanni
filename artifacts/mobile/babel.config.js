const appRoot = process.env.EXPO_ROUTER_APP_ROOT || "./app";
process.env.EXPO_ROUTER_APP_ROOT = appRoot;

module.exports = function (api) {
  api.cache.using(() => process.env.EXPO_ROUTER_APP_ROOT || "./app");
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    // Do not add plugins here after the preset: babel-preset-expo appends
    // react-native-worklets/plugin last. An extra plugin (e.g. expo-router) breaks
    // Reanimated in release builds and can crash the app on launch with no UI error.
    // EAS expo-router root is handled by metro-router-ctx.js + eas.json env.
  };
};
