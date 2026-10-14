import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  type ClientCredentials,
  type IdentityAuth,
  identityAuthFor,
} from "../auth/identity-auth.js";
import type { IdentityEmail } from "../mail/identity-mailer.js";
import { IdentityTestDatabase, truncateIdentityTables } from "./identity-test-database.js";

export const IDENTITY_BASE_URL = "http://localhost:3002";
export const APP_URL = "http://localhost:3000";

type Harness = {
  readonly sent: ReadonlyArray<IdentityEmail>;
  readonly makeAuth: () => IdentityAuth;
  readonly makeSeedingAuth: (client: Option.Option<ClientCredentials>) => IdentityAuth;
  // Truncates the identity tables and forgets the recorded mail; run at the start of each test.
  readonly reset: Effect.Effect<void>;
};

const makeHarness = Effect.gen(function* () {
  const database = yield* IdentityTestDatabase;
  const sent: Array<IdentityEmail> = [];

  const settings = (registerClientAs: Option.Option<ClientCredentials>) => ({
    baseUrl: IDENTITY_BASE_URL,
    secret: "identity-integration-tests-secret-0123456789abcdef",
    appUrl: APP_URL,
    database,
    mailer: {
      send: (email: IdentityEmail) =>
        Effect.sync(() => {
          sent.push(email);
        }),
    },
    runInBackground: Option.none(),
    registerClientAs,
  });

  const harness: Harness = {
    sent,
    makeAuth: () => identityAuthFor(settings(Option.none())),
    makeSeedingAuth: (client) =>
      identityAuthFor({ ...settings(client), sendVerificationOnSignUp: false }),
    reset: Effect.sync(() => {
      sent.length = 0;
    }).pipe(Effect.andThen(truncateIdentityTables(database))),
  };

  return harness;
});

// Better Auth wired to the identity test database, with a mailer that records instead of sending.
export class IdentityTestHarness extends Context.Service<IdentityTestHarness, Harness>()(
  "IdentityTestHarness",
) {
  public static readonly layer = Layer.effect(IdentityTestHarness, makeHarness).pipe(
    Layer.provideMerge(IdentityTestDatabase.layer),
  );
}

export const formPost = (path: string, fields: Readonly<Record<string, string>>): Request =>
  new Request(`${IDENTITY_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      origin: IDENTITY_BASE_URL,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
  });

class NoLinkInEmail extends Schema.TaggedError<
  NoLinkInEmail,
  { readonly brand: "NoLinkInEmail" }
>()("NoLinkInEmail", {}) {}

export const linkIn = (email: Option.Option<IdentityEmail>): Effect.Effect<URL> =>
  Option.flatMap(email, ({ text }) => Option.fromNullOr(/https?:\/\/\S+/.exec(text))).pipe(
    Option.match({
      onNone: () => Effect.die(new NoLinkInEmail()),
      onSome: (match) => Effect.succeed(new URL(match[0])),
    }),
  );
