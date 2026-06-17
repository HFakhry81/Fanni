const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const WEB_STUB = path.resolve(__dirname, "web-stubs/react-native-maps.js");

const NATIVE_ONLY_MODULES = new Set([
  "react-native-maps",
]);

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && NATIVE_ONLY_MODULES.has(moduleName)) {
    return { filePath: WEB_STUB, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
