// Shim for react-dom in React Native
// @clerk/clerk-react imports react-dom but doesn't use DOM features in RN context

'use strict';

const createPortal = () => null;
const findDOMNode = () => null;
const flushSync = (fn) => fn();
const hydrate = () => {};
const render = () => {};
const unmountComponentAtNode = () => false;
const unstable_batchedUpdates = (fn) => fn();
const version = '19.0.0';

// For react-dom/client imports
const createRoot = () => ({
  render: () => {},
  unmount: () => {},
});
const hydrateRoot = () => ({
  render: () => {},
  unmount: () => {},
});

module.exports = {
  createPortal,
  findDOMNode,
  flushSync,
  hydrate,
  render,
  unmountComponentAtNode,
  unstable_batchedUpdates,
  version,
  createRoot,
  hydrateRoot,
  // Default export for ES module interop
  default: {
    createPortal,
    findDOMNode,
    flushSync,
    hydrate,
    render,
    unmountComponentAtNode,
    unstable_batchedUpdates,
    version,
    createRoot,
    hydrateRoot,
  },
};
