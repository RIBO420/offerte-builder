const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver for react-dom shim (required by @clerk/clerk-react)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-dom': path.resolve(__dirname, 'shims/react-dom.js'),
  'react-dom/client': path.resolve(__dirname, 'shims/react-dom-client.js'),
};

// Also add to resolveRequest for nested requires
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-dom') {
    return {
      filePath: path.resolve(__dirname, 'shims/react-dom.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'react-dom/client') {
    return {
      filePath: path.resolve(__dirname, 'shims/react-dom-client.js'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
