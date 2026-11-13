const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure proper asset extensions for docs, images, and fonts
config.resolver.assetExts.push(
  'db',
  'mp3',
  'ttf',
  'otf',
  'png',
  'jpg',
  'jpeg',
  'svg',
  'pdf'
);

// Limit max workers to avoid memory overload on constrained build environments
config.maxWorkers = 2;

module.exports = config;
