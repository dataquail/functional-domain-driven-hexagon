import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export type IdentityEnv = Readonly<Partial<Record<string, string>>>;

export type AppClientRegistration = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly clientName: string;
  readonly redirectUris: ReadonlyArray<string>;
  readonly postLogoutRedirectUris: ReadonlyArray<string>;
};

export type SeedUser = { readonly email: string; readonly password: string; readonly name: string };

export type SeededUser = { readonly email: string; readonly subject: string };

export type Queryable = {
  readonly query: (
    text: string,
    params?: ReadonlyArray<string>,
  ) => Promise<{ readonly rows: ReadonlyArray<unknown> }>;
};

export type SqlRunner = (
  text: string,
  params?: ReadonlyArray<string>,
) => Effect.Effect<{ readonly rows: ReadonlyArray<unknown> }>;

export const IDENTITY_PROVIDER = "better-auth";

export class IdentitySettingMissing extends Schema.TaggedError<
  IdentitySettingMissing,
  { readonly brand: "IdentitySettingMissing" }
>()("IdentitySettingMissing", { message: Schema.String }) {}

export class IdentityUnreachable extends Schema.TaggedError<
  IdentityUnreachable,
  { readonly brand: "IdentityUnreachable" }
>()("IdentityUnreachable", { message: Schema.String }) {}

export class SeedRefused extends Schema.TaggedError<
  SeedRefused,
  { readonly brand: "SeedRefused" }
>()("SeedRefused", { message: Schema.String }) {}

class SuperAdminRowMissing extends Schema.TaggedError<
  SuperAdminRowMissing,
  { readonly brand: "SuperAdminRowMissing" }
>()("SuperAdminRowMissing", { email: Schema.String }) {}

const SeedRequestBody = Schema.Struct({
  client: Schema.optionalKey(
    Schema.Struct({
      clientId: Schema.String,
      clientSecret: Schema.String,
      clientName: Schema.String,
      redirectUris: Schema.Array(Schema.String),
      postLogoutRedirectUris: Schema.Array(Schema.String),
    }),
  ),
  users: Schema.Array(
    Schema.Struct({ email: Schema.String, password: Schema.String, name: Schema.String }),
  ),
});

const encodeSeedRequestBody = Schema.encodeSync(Schema.fromJsonString(SeedRequestBody));

const SeedResponse = Schema.Struct({
  users: Schema.Array(Schema.Struct({ email: Schema.String, subject: Schema.String })),
});

const UserIdRow = Schema.Struct({ id: Schema.String });

const decodeUserIdRow = Schema.decodeUnknownOption(UserIdRow);

// An unset or empty variable is refused by name, before anything is sent.
const required = (env: IdentityEnv, name: string) =>
  Config.NonEmptyString(name)
    .parse(ConfigProvider.fromEnvRecord(env))
    .pipe(Effect.mapError(() => new IdentitySettingMissing({ message: `${name} is not set` })));

const withDefault = (env: IdentityEnv, name: string, fallback: string): string =>
  Option.getOrElse(Option.fromUndefinedOr(env[name]), () => fallback);

export const appClientFromEnv = (env: IdentityEnv): AppClientRegistration =>
  Effect.runSync(
    Effect.all({
      clientId: required(env, "IDENTITY_CLIENT_ID"),
      clientSecret: required(env, "IDENTITY_CLIENT_SECRET"),
    }).pipe(
      Effect.map(({ clientId, clientSecret }) => ({
        clientId,
        clientSecret,
        clientName: "Effect Monorepo",
        redirectUris: [
          withDefault(env, "IDENTITY_REDIRECT_URI", "http://localhost:3000/api/auth/callback"),
        ],
        postLogoutRedirectUris: [
          withDefault(env, "IDENTITY_POST_LOGOUT_REDIRECT_URI", "http://localhost:3000/"),
        ],
      })),
    ),
  );

export const checkIdentityReachable = Effect.fn("checkIdentityReachable")(function* (
  env: IdentityEnv,
) {
  const discovery = `${yield* required(env, "IDENTITY_ISSUER")}/.well-known/openid-configuration`;
  const client = yield* HttpClient.HttpClient;

  const response = yield* client.get(discovery).pipe(
    Effect.mapError(
      (cause) =>
        new IdentityUnreachable({
          message: `The identity Worker is not reachable at ${discovery}. Start it with \`pnpm dev\`. (${cause.message})`,
        }),
    ),
  );

  if (response.status >= 300) {
    return yield* new IdentityUnreachable({ message: `${discovery} answered ${response.status}` });
  }
});

export type SeedIdentityParams = {
  readonly env: IdentityEnv;
  readonly client?: AppClientRegistration;
  readonly users: ReadonlyArray<SeedUser>;
};

const refusal = (response: HttpClientResponse.HttpClientResponse) =>
  response.text.pipe(
    Effect.orDie,
    Effect.flatMap(
      (body) =>
        new SeedRefused({
          message: `The identity Worker refused the seed: ${response.status} ${body}`,
        }),
    ),
  );

const seededUsersOf = (response: HttpClientResponse.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(SeedResponse)(response).pipe(
    Effect.orDie,
    Effect.map(({ users }) => users),
  );

export const seedUsersThroughWorker = Effect.fn("seedUsersThroughWorker")(function* ({
  env,
  ...body
}: SeedIdentityParams) {
  const issuer = new URL(yield* required(env, "IDENTITY_ISSUER"));
  const seedToken = yield* required(env, "IDENTITY_SEED_TOKEN");
  const client = yield* HttpClient.HttpClient;

  const response = yield* client
    .execute(
      HttpClientRequest.post(`${issuer.origin}/internal/seed`).pipe(
        HttpClientRequest.bearerToken(seedToken),
        HttpClientRequest.bodyText(encodeSeedRequestBody(body), "application/json"),
      ),
    )
    .pipe(Effect.orDie);

  if (response.status >= 300) return yield* refusal(response);

  return yield* seededUsersOf(response);
});

export const assertIdentityReachable = (env: IdentityEnv): Promise<void> =>
  Effect.runPromise(checkIdentityReachable(env).pipe(Effect.provide(FetchHttpClient.layer)));

export const seedIdentityUsers = (params: SeedIdentityParams): Promise<ReadonlyArray<SeededUser>> =>
  Effect.runPromise(seedUsersThroughWorker(params).pipe(Effect.provide(FetchHttpClient.layer)));

const superAdminStatements = Effect.fn("superAdminStatements")(function* (
  run: SqlRunner,
  { email, subject }: SeededUser,
) {
  yield* run(
    `INSERT INTO "user".users (id, email, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [email],
  );
  const { rows } = yield* run(`SELECT id FROM "user".users WHERE email = $1`, [email]);
  const row = decodeUserIdRow(rows[0]);

  if (Option.isNone(row)) return yield* Effect.die(new SuperAdminRowMissing({ email }));
  const userId = row.value.id;

  yield* run(
    `INSERT INTO auth.auth_identities (subject, user_id, provider, created_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (subject) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [subject, userId, IDENTITY_PROVIDER],
  );
  yield* run(
    `INSERT INTO platform.roles (user_id, role) VALUES ($1, 'super_admin')
     ON CONFLICT (user_id, role) DO NOTHING`,
    [userId],
  );

  return userId;
});

const transactionEnd = (exit: Exit.Exit<string>): string =>
  Exit.match(exit, { onSuccess: () => "COMMIT", onFailure: () => "ROLLBACK" });

// Records a seeded identity in the app database as a super-admin, in one transaction.
export const recordSuperAdminWith = (run: SqlRunner, user: SeededUser) =>
  Effect.acquireUseRelease(
    run("BEGIN"),
    () => superAdminStatements(run, user),
    (_, exit) => run(transactionEnd(exit)),
  );

export const recordSuperAdmin = (database: Queryable, user: SeededUser): Promise<string> =>
  Effect.runPromise(
    recordSuperAdminWith(
      (text, params) => Effect.promise(() => database.query(text, params)),
      user,
    ),
  );
