import { makeCliClient, readCredentials, resolveBaseUrl, resolveToken } from "@org/api-client";
import * as Config from "effect/Config";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Schema from "effect/Schema";

// The CLI's user-facing failure. Everything fatal is funnelled here so the
// entrypoint can print one clean line and exit non-zero (no stack dump).
export class CliError extends Schema.TaggedError<CliError, { readonly brand: "CliError" }>()(
  "CliError",
  {
    message: Schema.String,
  },
) {}

// Builds an authenticated CLI client from the stored/env token, or fails with
// a friendly nudge to sign in.
export const authedClient = Effect.gen(function* () {
  const creds = yield* readCredentials;
  const token = yield* resolveToken(creds);

  if (Option.isNone(token)) {
    return yield* new CliError({
      message: "Not authenticated. Run `org auth login`, or set APP_API_TOKEN.",
    });
  }

  const baseUrl = yield* resolveBaseUrl;

  return yield* makeCliClient({ baseUrl, token });
});

// Resolves the org id from an explicit `--org` flag, else the configured
// default, else fails.
export const resolveOrg = (explicit: Option.Option<string>) =>
  Effect.gen(function* () {
    if (Option.isSome(explicit)) return explicit.value;
    const creds = yield* readCredentials;
    const configured = Option.fromUndefinedOr(creds.defaultOrgId);

    if (Option.isSome(configured)) return configured.value;

    return yield* new CliError({
      message: "No organization selected. Pass --org <id> or run `org config set-org <id>`.",
    });
  });

const openerOptions = {
  stdin: "ignore",
  stdout: "ignore",
  stderr: "ignore",
  detached: true,
  forceKillAfter: Duration.seconds(2),
} as const;

const browserOpener = (url: string): ChildProcess.Command => {
  if (process.platform === "darwin") return ChildProcess.make("open", [url], openerOptions);

  if (process.platform === "win32") {
    return ChildProcess.make("cmd", ["/c", "start", "", url], openerOptions);
  }

  return ChildProcess.make("xdg-open", [url], openerOptions);
};

// Best-effort: open the verification URL in the user's browser. Failure is
// fine — the URL is also printed. Skipped in headless/CI contexts
// (`NO_BROWSER=1` or `CI` set) so automation doesn't spawn a browser.
export const openBrowser = (url: string) =>
  Effect.gen(function* () {
    const noBrowser = yield* Config.String("NO_BROWSER").pipe(Config.withDefault(""));
    const ci = yield* Config.String("CI").pipe(Config.withDefault(""));

    if (noBrowser === "1" || ci !== "") return;

    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    yield* spawner.exitCode(browserOpener(url));
  }).pipe(Effect.ignore);

// Show enough of a token to recognise it, never the whole secret.
export const maskToken = (token: string): string => {
  if (token.length <= 16) return `${token.slice(0, 4)}…`;

  return `${token.slice(0, 12)}…${token.slice(-4)}`;
};

// Every failure a CLI client call or the CLI itself can raise is a tagged error.
export type CliFailure = { readonly _tag: string; readonly message: string };

const messageOr = (message: string, fallback: string): string =>
  Option.liftPredicate(message, (text) => text.length > 0).pipe(Option.getOrElse(() => fallback));

const friendlyMessage = (error: CliFailure, baseUrl: string): string =>
  Match.value(error._tag).pipe(
    Match.when(
      "Unauthorized",
      () => "Not authorized — your token may be invalid or expired. Run `org auth login`.",
    ),
    Match.when("Forbidden", () => "You don't have access to that organization or resource."),
    Match.when(
      "ServiceUnavailable",
      () => "The server is temporarily unavailable. Try again shortly.",
    ),
    Match.when("CliTodoNotFoundError", () => messageOr(error.message, "Todo not found.")),
    Match.when(
      "DeviceTokenExpired",
      () => "The device code expired before approval. Run `org auth login` again.",
    ),
    Match.when(
      "DeviceCodeNotFound",
      () => "That device code is invalid. Run `org auth login` again.",
    ),
    Match.when("HttpClientError", () => `Could not reach the server at ${baseUrl}.`),
    Match.orElse((tag) => `Request failed (${tag}).`),
  );

// Maps any wire/domain failure to a single friendly `CliError`. Wrap a
// command's body with `Effect.catch(toCliError)` so the entrypoint only
// ever sees `CliError`.
export const toCliError = (error: CliFailure): Effect.Effect<never, CliError> => {
  if (Schema.is(CliError)(error)) return Effect.fail(error);

  return Effect.flatMap(resolveBaseUrl, (baseUrl) =>
    Effect.fail(new CliError({ message: friendlyMessage(error, baseUrl) })),
  );
};
