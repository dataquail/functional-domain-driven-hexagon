import type { ServerRuntime } from "@/services/runtime.server";

// The Worker bindings the Alchemy stack declares for this app. Only
// src/lib/server/platform.ts reads them.
declare global {
  namespace App {
    // Kit merges these declarations into its own, so they must stay interfaces.
    // oxlint-disable-next-line typescript/consistent-type-definitions
    interface Platform {
      readonly env: { readonly SERVER: Fetcher };
      readonly ctx: ExecutionContext;
    }
    // oxlint-disable-next-line typescript/consistent-type-definitions
    interface Locals {
      runtime: ServerRuntime;
    }
  }
}

export {};
