const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || "./app";

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch only the mobile app + shared workspace libs — not the whole monorepo
// node_modules tree (Metro FallbackWatcher crashes on corrupt NTFS entries under .pnpm).
config.watchFolders = [
  ...new Set([
    ...(config.watchFolders ?? []),
    projectRoot,
    path.resolve(workspaceRoot, "lib/api-client-react"),
    path.resolve(workspaceRoot, "lib/api-zod"),
  ]),
];
config.resolver.nodeModulesPaths = [
  ...new Set([
    ...(config.resolver.nodeModulesPaths ?? []),
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ]),
];

// Skip dependency sourcemaps; they are not needed for bundling and some Windows
// installs leave ghost .map files that make lstat fail with errno -4094.
const mapBlock = /node_modules[/\\].*\.map$/;
const existingBlockList = config.resolver.blockList;
if (Array.isArray(existingBlockList)) {
  config.resolver.blockList = [...existingBlockList, mapBlock];
} else if (existingBlockList instanceof RegExp) {
  config.resolver.blockList = [existingBlockList, mapBlock];
} else if (typeof existingBlockList === "function") {
  const prev = existingBlockList;
  config.resolver.blockList = (filePath) => prev(filePath) || mapBlock.test(filePath);
} else {
  config.resolver.blockList = [mapBlock];
}

const ROUTER_CTX = path.resolve(projectRoot, "metro-router-ctx.js");

const isExpoRouterCtx = (context, moduleName) => {
  if (
    moduleName === "expo-router/_ctx" ||
    moduleName === "expo-router/_ctx.android" ||
    moduleName === "expo-router/_ctx.web"
  ) {
    return true;
  }
  if (!moduleName.startsWith("./_ctx")) return false;
  const origin = context.originModulePath || "";
  return origin.replace(/\\/g, "/").includes("/expo-router/");
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isExpoRouterCtx(context, moduleName)) {
    return { filePath: ROUTER_CTX, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
