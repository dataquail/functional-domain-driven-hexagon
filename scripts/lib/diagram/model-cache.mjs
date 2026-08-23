import { clearPrograms } from "./program.mjs";

const caches = new Set();

// One TypeScript program per run is the whole cost of generating a diagram
// (~1s against ~10ms to draw one), so every reader shares these and the server
// keeps them warm until a source file actually changes.
export const cached = (build) => {
  let value;
  let held = false;
  const cache = {
    get: (...args) => {
      if (!held) {
        value = build(...args);
        held = true;
      }
      return value;
    },
    clear: () => {
      value = undefined;
      held = false;
    },
  };
  caches.add(cache);
  return cache;
};

export const clearCaches = () => {
  for (const cache of caches) cache.clear();
  clearPrograms();
};
