import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export type IdentityEnv = Readonly<Record<string, string | undefined>>;

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
    params?: ReadonlyArray<unknown>,
  ) => Promise<{ readonly rows: ReadonlyArray<Record<string, unknown>> }>;
};

export const IDENTITY_PROVIDER = "better-auth";

const SeedResponse = Schema.Struct({
  users: Schema.Array(Schema.Struct({ email: Schema.String, subject: Schema.String })),
});
const decodeSeedResponse = Schema.decodeUnknownPromise(SeedResponse);

const required = (env: IdentityEnv, name: string): string => {
  const value = env[name];
  if (value === undefined || value === "") throw new Error(`${name} is not set`);
  return value;
};

export const appClientFromEnv = (env: IdentityEnv): AppClientRegistration => ({
  clientId: required(env, "IDENTITY_CLIENT_ID"),
  clientSecret: required(env, "IDENTITY_CLIENT_SECRET"),
  clientName: "Effect Monorepo",
  redirectUris: [env.IDENTITY_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback"],
  postLogoutRedirectUris: [env.IDENTITY_POST_LOGOUT_REDIRECT_URI ?? "http://localhost:3000/"],
});

export const assertIdentityReachable = (
  env: IdentityEnv,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> => {
  const discovery = `${required(env, "IDENTITY_ISSUER")}/.well-known/openid-configuration`;
  return fetch(discovery).then(
    (response) => {
      if (!response.ok) throw new Error(`${discovery} answered ${response.status}`);
    },
    (cause: unknown) => {
      throw new Error(
        `The identity Worker is not reachable at ${discovery}. Start it with \`pnpm dev:cf\`. (${String(cause)})`,
      );
    },
  );
};

export type SeedIdentityParams = {
  readonly env: IdentityEnv;
  readonly client?: AppClientRegistration;
  readonly users: ReadonlyArray<SeedUser>;
  readonly fetch?: typeof globalThis.fetch;
};

export const seedIdentityUsers = ({
  client,
  env,
  fetch = globalThis.fetch,
  users,
}: SeedIdentityParams): Promise<ReadonlyArray<SeededUser>> =>
  fetch(`${new URL(required(env, "IDENTITY_ISSUER")).origin}/internal/seed`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${required(env, "IDENTITY_SEED_TOKEN")}`,
    },
    body: JSON.stringify(client === undefined ? { users } : { client, users }),
  }).then((response) =>
    response.ok
      ? response
          .json()
          .then(decodeSeedResponse)
          .then(({ users: seeded }) => seeded)
      : response.text().then((body) => {
          throw new Error(`The identity Worker refused the seed: ${response.status} ${body}`);
        }),
  );

const superAdminStatements = Effect.fn("superAdminStatements")(function* (
  database: Queryable,
  { email, subject }: SeededUser,
) {
  const run = (text: string, params: ReadonlyArray<unknown> = []) =>
    Effect.promise(() => database.query(text, params));
  yield* run(
    `INSERT INTO "user".users (id, email, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [email],
  );
  const { rows } = yield* run(`SELECT id FROM "user".users WHERE email = $1`, [email]);
  const userId = rows[0]?.id;
  if (typeof userId !== "string") {
    return yield* Effect.die(`could not read back the user row for ${email}`);
  }
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

// Records a seeded identity in the app database as a super-admin, in one transaction.
export const recordSuperAdmin = (database: Queryable, user: SeededUser): Promise<string> =>
  Effect.runPromise(
    Effect.acquireUseRelease(
      Effect.promise(() => database.query("BEGIN")),
      () => superAdminStatements(database, user),
      (_, exit) =>
        Effect.promise(() => database.query(exit._tag === "Success" ? "COMMIT" : "ROLLBACK")),
    ),
  );
