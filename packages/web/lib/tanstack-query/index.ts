// Barrel matches packages/client/src/lib/tanstack-query/index.ts so
// data-access modules port verbatim. The split-server module
// (effect-prefetch.server.ts) is intentionally NOT re-exported here —
// it has `import "server-only"` and pulling it into a client-side
// barrel would poison the bundle.
export * as QueryData from "./query-data-helpers";
export * from "./use-effect-mutation";
export * from "./use-effect-suspense-query";
