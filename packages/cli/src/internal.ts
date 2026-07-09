import { spawn } from "node:child_process";

import { makeCliClient, readCredentials, resolveBaseUrl, resolveToken } from "@org/api-client";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

// The CLI's user-facing failure. Everything fatal is funnelled here so the
// entrypoint can print one clean line and exit non-zero (no stack dump).
export class CliError extends Data.TaggedError("CliError")<{ readonly message: string }> {}

// Builds an authenticated CLI client from the stored/env token, or fails with
// a friendly nudge to sign in.
export const authedClient = Effect.gen(function* () {
  const creds = yield* readCredentials;
  const token = resolveToken(creds);
  if (token === null) {
    return yield* Effect.fail(
      new CliError({
        message: "Not authenticated. Run `org auth login`, or set APP_API_TOKEN.",
      }),
    );
  }
  return yield* makeCliClient({ baseUrl: resolveBaseUrl(), token });
});

// Resolves the org id from an explicit `--org` flag, else the configured
// default, else fails.
export const resolveOrg = (explicit: Option.Option<string>) =>
  Effect.gen(function* () {
    if (Option.isSome(explicit)) return explicit.value;
    const creds = yield* readCredentials;
    if (creds.defaultOrgId !== undefined) return creds.defaultOrgId;
    return yield* Effect.fail(
      new CliError({
        message: "No organization selected. Pass --org <id> or run `org config set-org <id>`.",
      }),
    );
  });

// Best-effort: open the verification URL in the user's browser. Failure is
// fine — the URL is also printed. Skipped in headless/CI contexts
// (`NO_BROWSER=1` or `CI` set) so automation doesn't spawn a browser.
export const openBrowser = (url: string) =>
  Effect.try(() => {
    if (process.env.NO_BROWSER === "1" || (process.env.CI ?? "") !== "") return;
    const opener =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    spawn(opener, args, { stdio: "ignore", detached: true }).unref();
  }).pipe(Effect.ignore);

// Show enough of a token to recognise it, never the whole secret.
export const maskToken = (token: string): string =>
  token.length <= 16 ? `${token.slice(0, 4)}…` : `${token.slice(0, 12)}…${token.slice(-4)}`;

// Maps any wire/domain failure to a single friendly `CliError`. Wrap a
// command's body with `Effect.catch(toCliError)` so the entrypoint only
// ever sees `CliError`.
export const toCliError = (error: unknown): CliError => {
  if (error instanceof CliError) return error;
  const tag =
    typeof error === "object" && error !== null && "_tag" in error
      ? String((error as { readonly _tag: unknown })._tag)
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { readonly message: unknown }).message)
      : "";
  switch (tag) {
    case "Unauthorized":
      return new CliError({
        message: "Not authorized — your token may be invalid or expired. Run `org auth login`.",
      });
    case "Forbidden":
      return new CliError({ message: "You don't have access to that organization or resource." });
    case "ServiceUnavailable":
      return new CliError({ message: "The server is temporarily unavailable. Try again shortly." });
    case "CliTodoNotFoundError":
      return new CliError({ message: message.length > 0 ? message : "Todo not found." });
    case "DeviceTokenExpired":
      return new CliError({
        message: "The device code expired before approval. Run `org auth login` again.",
      });
    case "DeviceCodeNotFound":
      return new CliError({ message: "That device code is invalid. Run `org auth login` again." });
    case "RequestError":
    case "ResponseError":
      return new CliError({ message: `Could not reach the server at ${resolveBaseUrl()}.` });
    default:
      return new CliError({ message: tag.length > 0 ? `Request failed (${tag}).` : String(error) });
  }
};
