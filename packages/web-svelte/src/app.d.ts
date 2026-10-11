// The Worker bindings the Alchemy stack declares for this app. Only
// src/lib/server/platform.ts reads them.
declare global {
  namespace App {
    // Kit merges this declaration into its own, so it must stay an interface.
    // oxlint-disable-next-line typescript/consistent-type-definitions
    interface Platform {
      readonly env: { readonly SERVER: Fetcher };
      readonly ctx: ExecutionContext;
    }
  }
}

export {};
