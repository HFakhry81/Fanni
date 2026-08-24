const appRoot = process.env.EXPO_ROUTER_APP_ROOT || "./app";
process.env.EXPO_ROUTER_APP_ROOT = appRoot;

module.exports = function (api) {
  api.cache.using(() => process.env.EXPO_ROUTER_APP_ROOT || "./app");
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [require("babel-preset-expo/build/expo-router-plugin").expoRouterBabelPlugin],
  };
};
