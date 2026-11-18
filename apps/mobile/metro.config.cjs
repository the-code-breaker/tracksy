const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const config = getDefaultConfig(__dirname);
// Bound transform workers so release bundling leaves memory for Gradle and D8.
config.maxWorkers = 2;
const workspaceRoot = path.resolve(__dirname, "../..");
const excluded = [
  ".local",
  "artifacts",
  "apps/mobile/android",
  "apps/mobile/ios",
  "apps/mobile/dist",
  "apps/mobile/dist-bundles",
  "apps/admin/.next",
].map((directory) => {
  const escaped = path.resolve(workspaceRoot, directory).split(path.sep)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\\\/]");
  return new RegExp(escaped + "(?:[\\\\/].*)?$");
});
const previous = config.resolver.blockList;
config.resolver.blockList = [
  ...(previous ? (Array.isArray(previous) ? previous : [previous]) : []),
  ...excluded,
];
module.exports = config;
