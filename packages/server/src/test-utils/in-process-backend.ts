// In-process backend harness. Builds the real HTTP handlers from
// `@/api.js` over the FakeDatabase + per-service fakes, exposes a
// `fetch`-shaped function that resolves inside this process via
// `HttpApiBuilder.toWebHandler`, plus direct programmatic access to
// the underlying state (db, events, clock, auth control).
//
// This is the foundation of the integration testing tier from the
// remediation plan §8. FE tests (in `@org/web`) wire their
// `ApiClient` to this `fetch` function and exercise the real
// presenter + data-access + backend handlers in a single process —
// no port, no socket, no child process, no schema duplication.
//
// Per ADR-0019, the isomorphic stack is what makes this possible:
// the backend handlers ARE the simulator. No drift hazard, no
// hand-written fakes that lag the real handlers' evolution.

import { Api } from "@/api.js";
import { EnvVars } from "@/common/env-vars.js";
import { authCommandHandlers, authQueryHandlers } from "@/modules/auth/index.js";
import { AuthIdentityRepositoryFakeShared } from "@/modules/auth/infrastructure/auth-identity-repository-fake.js";
import { OidcClient } from "@/modules/auth/infrastructure/oidc-client.js";
import { SessionRepositoryFakeShared } from "@/modules/auth/infrastructure/session-repository-fake.js";
import { AuthHttpLive } from "@/modules/auth/interface/auth-http-live.js";
import { todoCommandHandlers, todoQueryHandlers } from "@/modules/todos/index.js";
import { TodosRepositoryFakeShared } from "@/modules/todos/infrastructure/todos-repository-fake.js";
import { TodosHttpLive } from "@/modules/todos/interface/todos-http-live.js";
import {
  userCommandHandlers,
  userEventSpanAttributes,
  userQueryHandlers,
} from "@/modules/user/index.js";
import { UserRepositoryFakeShared } from "@/modules/user/infrastructure/user-repository-fake.js";
import { UserHttpLive } from "@/modules/user/interface/user-http-live.js";
import { UserEventAdapterLive } from "@/modules/wallet/event-handlers/user-event-adapter.js";
import { walletEventSpanAttributes } from "@/modules/wallet/index.js";
import { WalletRepositoryFakeShared } from "@/modules/wallet/infrastructure/wallet-repository-fake.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { PermissionsResolver } from "@/platform/auth/permissions-resolver.js";
import { CommandBus, makeCommandBus } from "@/platform/command-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { makeQueryBus, QueryBus } from "@/platform/query-bus.js";
import { IdentityTransactionRunner } from "@/test-utils/identity-transaction-runner.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as HttpServer from "@effect/platform/HttpServer";
import { type Permission, UserAuthMiddleware } from "@org/contracts/Policy";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";
import * as Ref from "effect/Ref";
import { FakeDatabaseServiceLive } from "./fake-database-service.js";
import { FakeDatabase, FakeDatabaseTag } from "./fake-database.js";

// ──────────────────────────────────────────────────────────────────
// Auth control surface — lets FE tests sign in as any user without
// running the OIDC dance. Holds a Ref of "currently authenticated"
// state; the in-process middleware reads it for every request.
// ──────────────────────────────────────────────────────────────────
export type AuthControl = {
  readonly signInAs: (user: {
    readonly userId: UserId;
    readonly permissions?: Set<Permission>;
  }) => void;
  readonly signOut: () => void;
};

type AuthState = {
  readonly userId: UserId;
  readonly permissions: Set<Permission>;
} | null;

const makeAuthMiddleware = (stateRef: Ref.Ref<AuthState>) =>
  Layer.succeed(
    UserAuthMiddleware,
    Effect.flatMap(Ref.get(stateRef), (state) => {
      if (state === null) {
        return Effect.die("TestBackend: no signed-in user (call backend.auth.signInAs first)");
      }
      return Effect.succeed({
        sessionId: "test-session",
        userId: state.userId,
        permissions: state.permissions,
      });
    }),
  );

// ──────────────────────────────────────────────────────────────────
// Layer composition. Mirrors `test-server.ts` but:
//   - swaps the live repositories for the FK-enforcing Shared fakes,
//   - swaps `AuthSharedDepsLive` for a layer that doesn't need
//     Postgres,
//   - swaps the real auth middleware for our state-Ref-driven one.
//
// Everything else (CommandBus, QueryBus, DomainEventBus, the HTTP
// modules) is exactly what production runs.
// ──────────────────────────────────────────────────────────────────
const CommandBusLive = Layer.succeed(
  CommandBus,
  makeCommandBus({ ...userCommandHandlers, ...todoCommandHandlers, ...authCommandHandlers }),
);
const QueryBusLive = Layer.succeed(
  QueryBus,
  makeQueryBus({ ...userQueryHandlers, ...todoQueryHandlers, ...authQueryHandlers }),
);
const DomainEventBusLive = makeDomainEventBusLive({
  spanAttributes: { ...userEventSpanAttributes, ...walletEventSpanAttributes },
});

const FakeRepositoriesShared = Layer.mergeAll(
  UserRepositoryFakeShared,
  WalletRepositoryFakeShared,
  TodosRepositoryFakeShared,
  SessionRepositoryFakeShared,
  AuthIdentityRepositoryFakeShared,
);

// In-process auth-infra wiring. Production layers
// `AuthSharedDepsLive` (CookieCodec + SessionRepositoryLive), but
// SessionRepository is supplied here by the fake repository umbrella
// and CookieCodec needs EnvVars (HMAC secret) we don't want to wire
// in tests. The FE never carries a session cookie in this tier — the
// `FakeAuthMiddleware` bypasses verification — so a stub that always
// rejects is sufficient to satisfy the auth module's typecheck.
const CookieCodecStub = Layer.succeed(
  CookieCodec,
  CookieCodec.of({
    sign: (id: string) => `${id}.stub`,
    verify: () => null,
  } as unknown as Context.Tag.Service<typeof CookieCodec>),
);

// OidcClient is used by the auth module's login + callback paths,
// neither of which are driven from in-process tests (the
// FakeAuthMiddleware bypasses the OIDC dance via
// `backend.auth.signInAs`). Stub everything to die so any accidental
// reach into these paths produces a clear test-side failure.
const OidcClientStub = Layer.succeed(
  OidcClient,
  OidcClient.of({
    authorize: () => Effect.die("OidcClient not wired in in-process backend"),
    exchangeCode: () => Effect.die("OidcClient not wired in in-process backend"),
    revokeRefreshToken: () => Effect.die("OidcClient not wired in in-process backend"),
    revokeSession: () => Effect.die("OidcClient not wired in in-process backend"),
  } as unknown as Context.Tag.Service<typeof OidcClient>),
);

// EnvVars.Default reads via `Config.redacted("DATABASE_URL")` etc.
// None of those vars need real values in the in-process backend
// (the consumers — CookieCodec, OIDC client, real Database layer —
// are replaced or never reached). Override the global ConfigProvider
// with a map containing benign placeholders so `EnvVars.Default`
// boots without `DATABASE_URL` set in process.env.
const InProcessConfig = ConfigProvider.fromMap(
  new Map<string, string>([
    ["DATABASE_URL", "postgresql://in-process/test"],
    ["ZITADEL_ISSUER", "http://localhost:8080"],
    ["ZITADEL_CLIENT_ID", "in-process"],
    ["ZITADEL_CLIENT_SECRET", "in-process"],
    ["SESSION_COOKIE_SECRET", "in-process-secret"],
  ]),
);
const InProcessConfigLayer = Layer.setConfigProvider(InProcessConfig);
const buildInProcessBackend = (db: FakeDatabase, authStateRef: Ref.Ref<AuthState>) => {
  const FakeDatabaseFixedLive = Layer.succeed(FakeDatabaseTag, db);
  const FakeAuthMiddleware = makeAuthMiddleware(authStateRef);

  // We compose the HTTP groups + the wallet event adapter directly
  // (not via per-module `XxxModuleLive`), so we can swap the Live
  // repositories that each module bakes in for the Shared fakes.
  // The OidcClient is omitted entirely — the FakeAuthMiddleware
  // bypasses the OIDC dance and `/auth/login` / `/auth/callback`
  // are not driven from in-process tests.
  const ApiLive = HttpApiBuilder.api(Api).pipe(
    Layer.provide([TodosHttpLive, UserHttpLive, AuthHttpLive, UserEventAdapterLive]),
    Layer.provide([FakeAuthMiddleware, DomainEventBusLive, IdentityTransactionRunner]),
    Layer.provideMerge(Layer.mergeAll(CommandBusLive, QueryBusLive)),
    Layer.provide(PermissionsResolver.Default),
    Layer.provide(CookieCodecStub),
    Layer.provide(OidcClientStub),
    Layer.provide(FakeRepositoriesShared),
    // PermissionsResolver and the read-side query handlers consume
    // `Database.Database`. Provide a fake backed by the same
    // FakeDatabase the repos use so read paths return rows that
    // reflect mutations made via the FE.
    Layer.provide(FakeDatabaseServiceLive(db)),
    Layer.provide(FakeDatabaseFixedLive),
    Layer.provide(EnvVars.Default),
    Layer.provide(InProcessConfigLayer),
    // Mirror server defaults: log warnings/errors to console so
    // in-process handler failures surface in test output instead of
    // being swallowed as opaque 500s.
    Layer.provide(Logger.minimumLogLevel(LogLevel.Warning)),
  );

  return ApiLive;
};

// ──────────────────────────────────────────────────────────────────
// Public handle: what tests interact with.
// ──────────────────────────────────────────────────────────────────
export type InProcessBackend = {
  // Front door — what the FE's ApiClient consumes. Same signature
  // as window.fetch; the call terminates inside this process via
  // HttpApiBuilder.toWebHandler.
  readonly fetch: typeof fetch;

  // Service door — direct programmatic access to internals.
  readonly db: FakeDatabase;
  readonly events: ReadonlyArray<unknown>; // populated by RecordingEventBus (future)
  readonly auth: AuthControl;

  readonly dispose: () => Promise<void>;
};

export type StartOptions = {
  readonly seed?: (db: FakeDatabase) => void;
  readonly signedInAs?: {
    readonly userId: UserId;
    readonly permissions?: Set<Permission>;
  };
};

const DEFAULT_PERMISSIONS = new Set<Permission>(["__test:read", "__test:manage", "__test:delete"]);

export const startInProcessBackend = async (opts: StartOptions = {}): Promise<InProcessBackend> => {
  const db = new FakeDatabase();
  if (opts.seed !== undefined) opts.seed(db);

  const initialAuth: AuthState =
    opts.signedInAs !== undefined
      ? {
          userId: opts.signedInAs.userId,
          permissions: opts.signedInAs.permissions ?? DEFAULT_PERMISSIONS,
        }
      : null;
  const authStateRef = Effect.runSync(Ref.make<AuthState>(initialAuth));

  const ApiLive = buildInProcessBackend(db, authStateRef);

  // `toWebHandler` builds the actual `(Request) => Promise<Response>`
  // function. It expects a Layer providing `HttpApi.Api` and the
  // HttpRouter DefaultServices (HttpPlatform / FileSystem / Path /
  // Generator) — `HttpServer.layerContext` supplies the latter.
  const { dispose, handler } = HttpApiBuilder.toWebHandler(
    Layer.mergeAll(ApiLive, HttpServer.layerContext),
  );

  const auth: AuthControl = {
    signInAs: (user) => {
      Effect.runSync(
        Ref.set(authStateRef, {
          userId: user.userId,
          permissions: user.permissions ?? DEFAULT_PERMISSIONS,
        }),
      );
    },
    signOut: () => {
      Effect.runSync(Ref.set(authStateRef, null));
    },
  };

  const fetchFn: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    return handler(request, Context.empty());
  };

  return {
    fetch: fetchFn,
    db,
    events: [],
    auth,
    dispose,
  };
};
