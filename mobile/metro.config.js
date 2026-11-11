const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch the monorepo shared tokens directory so Metro resolves ../../shared/design-tokens.json cleanly.
config.watchFolders = [path.resolve(__dirname, '../shared')];

module.exports = config;
