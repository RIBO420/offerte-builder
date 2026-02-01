// Shim for react-dom/client in React Native
'use strict';

const createRoot = () => ({
  render: () => {},
  unmount: () => {},
});

const hydrateRoot = () => ({
  render: () => {},
  unmount: () => {},
});

module.exports = {
  createRoot,
  hydrateRoot,
};
