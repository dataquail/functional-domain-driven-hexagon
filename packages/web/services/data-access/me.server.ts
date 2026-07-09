// Server-only helper: resolve the current user (or null if unauthenticated).
// The (authed) layout uses this for the guard; the Nav uses it to render
// the conditional Admin link only for super-admins.

import "server-only";

import type { AuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import React from "react";

import { ApiClient } from "@/services/api-client.shared";
import { getServerRuntime } from "@/services/runtime.server";

// Wrapped in React's `cache` so it is memoized for the lifetime of a single
// server request. Multiple server components render per navigation — the
// `(authed)` guard, a nested guard (e.g. `admin/layout`), and the nav all
// call this — and without memoization each fires its own `/auth/me`, which
// on the BFF is a FindSession + TouchSession + role lookup every time. That
// produced N redundant request trees in one Jaeger trace. `cache` collapses
// them to one call (one session touch, one role query) per request.
export const fetchCurrentUser = React.cache(
  async (): Promise<AuthContract.CurrentUserResponse | null> => {
    const runtime = await getServerRuntime();
    const exit = await runtime.runPromiseExit(
      Effect.flatMap(ApiClient, ({ client }) => client.authSession.me()),
    );
    return Exit.isSuccess(exit) ? exit.value : null;
  },
);
