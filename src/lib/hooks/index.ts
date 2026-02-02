// Hook factory utilities for reducing boilerplate in resource hooks
export {
  createGetResourceHook,
  createSearchHook,
  createListHook,
  createMutationsHook,
  createCombinedResourceHook,
  createListWithComputedHook,
} from "./use-resource-factory";

export type {
  UseGetReturn,
  QueryListItem,
  QueryGetItem,
} from "./use-resource-factory";
