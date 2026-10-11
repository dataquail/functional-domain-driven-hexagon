// The component library's DOM matchers and jsdom stubs (matchMedia, pointer
// capture), which the toaster, the theme and the select need here too.
import "@org/components-svelte/test/setup";

import { installMswLifecycle } from "./msw-server";

// MSW is installed for the whole suite, not per file: a View that reads a
// reactivity-wrapped query atom can fetch when it mounts however its atoms
// were seeded, so no test file can decide it needs no server.
installMswLifecycle();
