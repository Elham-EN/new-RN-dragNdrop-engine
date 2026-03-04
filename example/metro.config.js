// metro.config.js — configures Metro to watch the parent library root so
// changes to src/ are reflected immediately without a rebuild step.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Root of the library package (one level up from this example app)
const libraryRoot = path.resolve(__dirname, "..");

const config = getDefaultConfig(__dirname);

// Tell Metro to watch the library root so it sees src/ changes live
config.watchFolders = [libraryRoot];

// Allow Metro to resolve modules from both example/node_modules and the library's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(libraryRoot, "node_modules"),
];

module.exports = config;
