// Device-approval data-access. Server-safe Effect only; the client hook
// layer in `use-device-queries.ts` wraps it as a mutation. There's nothing
// to prefetch (the page just renders a form), so no `.server.ts` sibling.

import * as Effect from "effect/Effect";

import { ApiClient } from "@/services/api-client.shared";

// Browser-side approval of a CLI device grant (ADR-0024): bind the grant
// identified by `userCode` to the signed-in caller.
export const approveDevice = (args: { readonly userCode: string }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.authDevice.approve({ payload: { userCode: args.userCode } }),
  );
