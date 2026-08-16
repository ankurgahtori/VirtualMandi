const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      // Let Metro produce its normal diagnostic if the extensionless module is absent.
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
