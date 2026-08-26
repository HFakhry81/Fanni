const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || "./app";

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  ...new Set([...(config.watchFolders ?? []), projectRoot, workspaceRoot]),
];
config.resolver.nodeModulesPaths = [
  ...new Set([
    ...(config.resolver.nodeModulesPaths ?? []),
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ]),
];

const ROUTER_CTX = path.resolve(projectRoot, "metro-router-ctx.js");

const isExpoRouterCtx = (context, moduleName) => {
  if (moduleName === "expo-router/_ctx" || moduleName === "expo-router/_ctx.android") {
    return true;
  }
  if (!moduleName.startsWith("./_ctx")) return false;
  const origin = context.originModulePath || "";
  return origin.replace(/\\/g, "/").includes("/expo-router/");
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== "web" && isExpoRouterCtx(context, moduleName)) {
    return { filePath: ROUTER_CTX, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
