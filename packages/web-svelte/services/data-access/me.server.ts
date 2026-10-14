// Server-only helper: resolve the current user (or null if unauthenticated).
// The (authed) layout's load calls it once per request for the guard and hands
// the user to every load and page beneath it.

import type { AuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { ApiClient } from "@/services/api-client.shared";
import { getServerRuntime } from "@/services/runtime.server";

export const fetchCurrentUser = async (): Promise<AuthContract.CurrentUserResponse | null> => {
  const runtime = await getServerRuntime();
  const exit = await runtime.runPromiseExit(
    Effect.flatMap(ApiClient, ({ client }) => client.authSession.me()),
  );
  return Exit.isSuccess(exit) ? exit.value : null;
};
