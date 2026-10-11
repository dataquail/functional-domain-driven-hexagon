import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { IDENTITY_SCOPES, type IdentityAuth } from "../auth/identity-auth.js";

export const SeedUser = Schema.Struct({
  email: Schema.String,
  password: Schema.String,
  name: Schema.String,
});
export type SeedUser = typeof SeedUser.Type;

export const AppClientRegistration = Schema.Struct({
  clientId: Schema.String,
  clientSecret: Schema.String,
  clientName: Schema.String,
  redirectUris: Schema.Array(Schema.String),
  postLogoutRedirectUris: Schema.Array(Schema.String),
});
export type AppClientRegistration = typeof AppClientRegistration.Type;

export const SeedRequest = Schema.Struct({
  client: Schema.optional(AppClientRegistration),
  users: Schema.NonEmptyArray(SeedUser),
});
export type SeedRequest = typeof SeedRequest.Type;

export type SeededUser = { readonly email: string; readonly subject: string };

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

const isHttpLoopback = (uri: string): boolean => {
  const url = new URL(uri);
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
};

// OAuth 2.1 gives a web client https only; plain-http localhost is admitted for native clients alone.
export const applicationTypeFor = (redirectUris: ReadonlyArray<string>): "web" | "native" =>
  redirectUris.length > 0 && redirectUris.every(isHttpLoopback) ? "native" : "web";

const clientMetadata = (registration: AppClientRegistration) => ({
  application_type: applicationTypeFor(registration.redirectUris),
  client_name: registration.clientName,
  redirect_uris: [...registration.redirectUris],
  post_logout_redirect_uris: [...registration.postLogoutRedirectUris],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code" as const],
  scope: IDENTITY_SCOPES.join(" "),
  skip_consent: true,
  enable_end_session: true,
});

const sessionCookieFor = Effect.fn("sessionCookieFor")(function* (
  auth: IdentityAuth,
  owner: SeedUser,
) {
  const response = yield* Effect.promise(() =>
    auth.api.signInEmail({
      body: { email: owner.email, password: owner.password },
      asResponse: true,
    }),
  );
  if (!response.ok) {
    return yield* Effect.die(`Seeding could not sign in as ${owner.email}: ${response.status}`);
  }
  const cookie = response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
});

const ensureAppClient = Effect.fn("ensureAppClient")(function* (
  auth: IdentityAuth,
  registration: AppClientRegistration,
  owner: SeedUser,
) {
  const context = yield* Effect.promise(() => auth.$context);
  const existing = yield* Effect.promise(() =>
    context.adapter.findOne({
      model: "oauthClient",
      where: [{ field: "clientId", value: registration.clientId }],
    }),
  );
  const headers = yield* sessionCookieFor(auth, owner);
  yield* Effect.promise(() =>
    existing === null
      ? auth.api.adminCreateOAuthClient({
          body: {
            ...clientMetadata(registration),
            token_endpoint_auth_method: "client_secret_post",
          },
          headers,
        })
      : auth.api.adminUpdateOAuthClient({
          body: { client_id: registration.clientId, update: clientMetadata(registration) },
          headers,
        }),
  );
});

const ensureVerifiedUser = Effect.fn("ensureVerifiedUser")(function* (
  auth: IdentityAuth,
  user: SeedUser,
) {
  const context = yield* Effect.promise(() => auth.$context);
  const found = yield* Effect.promise(() => context.internalAdapter.findUserByEmail(user.email));
  const id =
    found?.user.id ??
    (yield* Effect.promise(() =>
      auth.api.signUpEmail({
        body: { email: user.email, password: user.password, name: user.name },
      }),
    )).user.id;
  if (found?.user.emailVerified !== true) {
    yield* Effect.promise(() => context.internalAdapter.updateUser(id, { emailVerified: true }));
  }
  return { email: user.email, subject: id } satisfies SeededUser;
});

export const seedIdentity = Effect.fn("seedIdentity")(function* (
  auth: IdentityAuth,
  { client, users }: SeedRequest,
) {
  const seeded = yield* Effect.forEach(users, (user) => ensureVerifiedUser(auth, user));
  if (client !== undefined) yield* ensureAppClient(auth, client, users[0]);
  return seeded;
});
