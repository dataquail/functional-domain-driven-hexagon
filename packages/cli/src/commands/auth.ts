import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import {
  clearToken,
  makeCliClient,
  readCredentials,
  resolveBaseUrl,
  resolveToken,
  saveToken,
} from "@org/api-client";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";

import { CliError, maskToken, openBrowser, toCliError } from "../internal.js";

// `auth login [--with-token <pat>]`
//   - with a token: store it (CI / paste path) and validate it.
//   - without: run the app-native device flow (RFC 8628) — print + open the
//     verification URL, then poll until the browser approves.
const withTokenOption = Flag.string("with-token").pipe(
  Flag.optional,
  Flag.withDescription("Store a pre-minted personal access token instead of the device flow"),
);

const validate = (token: string) =>
  Effect.flatMap(makeCliClient({ baseUrl: resolveBaseUrl(), token }), (client) =>
    client.cliOrganization.listMine(),
  );

const login = Command.make("login", { withToken: withTokenOption }, ({ withToken }) =>
  Effect.gen(function* () {
    if (Option.isSome(withToken)) {
      yield* validate(withToken.value);
      yield* saveToken(withToken.value);
      yield* Console.log("✓ Token stored and verified.");
      return;
    }

    const client = yield* makeCliClient({ baseUrl: resolveBaseUrl(), token: null });
    const start = yield* client.cliAuth.deviceStart();
    yield* Console.log(
      [
        "",
        "To sign in, open this URL in your browser:",
        "",
        `  ${start.verification_uri_complete}`,
        "",
        `and confirm the code:  ${start.user_code}`,
        "",
        "Waiting for approval…",
      ].join("\n"),
    );
    yield* openBrowser(start.verification_uri_complete);

    // Poll the token endpoint; keep retrying while the grant is pending,
    // bounded by the grant's own lifetime.
    const token = yield* client.cliAuth
      .deviceToken({ payload: { device_code: start.device_code } })
      .pipe(
        Effect.retry({
          while: (error) => error._tag === "DeviceAuthorizationPending",
          schedule: Schedule.spaced(Duration.seconds(start.interval)),
        }),
        Effect.timeoutOrElse({
          duration: Duration.seconds(start.expires_in + 5),
          orElse: () =>
            Effect.fail(
              new CliError({ message: "Timed out waiting for device approval. Try again." }),
            ),
        }),
      );

    yield* saveToken(token.access_token);
    yield* Console.log("✓ Authenticated! You're signed in.");
  }).pipe(Effect.catch((error) => Effect.fail(toCliError(error)))),
);

const status = Command.make("status", {}, () =>
  Effect.gen(function* () {
    const creds = yield* readCredentials;
    const token = resolveToken(creds);
    if (token === null) {
      yield* Console.log("Not authenticated. Run `org auth login`.");
      return;
    }
    const client = yield* makeCliClient({ baseUrl: resolveBaseUrl(), token });
    yield* client.cliOrganization.listMine().pipe(
      Effect.matchEffect({
        onSuccess: () => Console.log(`Authenticated (token ${maskToken(token)}).`),
        onFailure: (error) =>
          error._tag === "Unauthorized"
            ? Console.log("Token is invalid or expired. Run `org auth login`.")
            : Effect.fail(toCliError(error)),
      }),
    );
  }),
);

const logout = Command.make("logout", {}, () =>
  Effect.gen(function* () {
    yield* clearToken;
    yield* Console.log(
      "Logged out — local credentials cleared. The token stays valid server-side until it expires; revoke it in the web UI to invalidate immediately.",
    );
  }),
);

export const authCommand = Command.make("auth", {}, () =>
  Console.log("Usage: org auth <login|status|logout>"),
).pipe(Command.withSubcommands([login, status, logout]));
