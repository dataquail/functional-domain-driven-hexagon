import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { type CurrentUser, CurrentUser as CurrentUserTag } from "@org/contracts/Policy";
import { PersistenceUnavailable } from "@org/cqrs";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/platform/ids/user-id.js";

import { Actions } from "./actions.js";
import * as Authz from "./authz.js";
import { type CheckFor, makePolicyRegistry } from "./policy-registry.js";
import { makeResourceResolverRegistry } from "./resource-resolver-registry.js";

// Synthetic registry entries scoped to this test file via declaration
// merging. Real module entries live in `modules/<m>/policies/*-policies.ts`.
//
// `test` is a SCOPED resource: it appears in ResourceResolverMap, so every
// action on it requires an id and receives the resolved resource.
// `testPlatform` is an UNSCOPED resource: absent from ResourceResolverMap, so
// no action on it takes an id and its checks only ever see the caller.
type ThingId = string & { readonly _brand: "ThingId" };
type Thing = { readonly id: ThingId; readonly ownerId: string };

declare module "./resource-resolver-registry.js" {
  interface ResourceResolverMap {
    test: { resourceType: Thing; idType: ThingId };
  }
}

declare module "./policy-registry.js" {
  interface PolicyMap {
    test: {
      read: CheckFor<"test">;
      update: CheckFor<"test">;
      create: CheckFor<"test">;
    };
    testPlatform: {
      read: CheckFor<"testPlatform">;
    };
  }
}

const callerMember: CurrentUser["Service"] = {
  sessionId: "s",
  userId: UserId.make("11111111-1111-1111-1111-111111111111"),
};

const knownThing: Thing = { id: "thing-1" as ThingId, ownerId: "u1" };

const provideRegistries = (opts: {
  readonly read: CheckFor<"test">;
  readonly update: CheckFor<"test">;
  readonly create: CheckFor<"test">;
  readonly platformRead?: CheckFor<"testPlatform">;
  readonly thingById?: (
    id: ThingId,
  ) => Effect.Effect<Thing, CustomHttpApiError.NotFound | PersistenceUnavailable>;
}) =>
  Layer.mergeAll(
    makePolicyRegistry([
      {
        test: {
          read: opts.read,
          update: opts.update,
          create: opts.create,
        },
        testPlatform: {
          read: opts.platformRead ?? (() => Effect.succeed(false)),
        },
      },
    ]),
    makeResourceResolverRegistry({
      test:
        opts.thingById ??
        ((id) =>
          id === knownThing.id
            ? Effect.succeed(knownThing)
            : Effect.fail(new CustomHttpApiError.NotFound())),
    }),
  );

const provideCurrentUser = (caller: CurrentUser["Service"]) =>
  Layer.succeed(CurrentUserTag, caller);

describe("makePolicyRegistry — array-of-checks AND composition", () => {
  it.effect("succeeds only when every check in the array returns true", () =>
    Authz.hasPermissions("test", Actions.Read, knownThing.id).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.mergeAll(
            makePolicyRegistry([
              {
                test: {
                  read: [() => Effect.succeed(true), () => Effect.succeed(true)],
                  update: () => Effect.succeed(false),
                  create: () => Effect.succeed(false),
                },
              },
            ]),
            makeResourceResolverRegistry({
              test: () => Effect.succeed(knownThing),
            }),
          ),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );

  it.effect("fails Forbidden as soon as any check in the array returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Authz.hasPermissions("test", Actions.Read, knownThing.id));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Forbidden, true);
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.mergeAll(
            makePolicyRegistry([
              {
                test: {
                  read: [
                    () => Effect.succeed(true),
                    () => Effect.succeed(false), // second check fails — overall denial
                    () => Effect.die("should have short-circuited"),
                  ],
                  update: () => Effect.succeed(false),
                  create: () => Effect.succeed(false),
                },
              },
            ]),
            makeResourceResolverRegistry({
              test: () => Effect.succeed(knownThing),
            }),
          ),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );
});

describe("Authz.hasPermissions (unscoped resource — takes no id)", () => {
  it.effect("succeeds when the registered policy returns true", () =>
    Authz.hasPermissions("testPlatform", Actions.Read).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: () => Effect.succeed(false),
            update: () => Effect.succeed(false),
            create: () => Effect.succeed(false),
            platformRead: () => Effect.succeed(true),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );

  it.effect("fails Forbidden when the registered policy returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Authz.hasPermissions("testPlatform", Actions.Read));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Forbidden, true);
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: () => Effect.succeed(true),
            update: () => Effect.succeed(true),
            create: () => Effect.succeed(true),
            platformRead: () => Effect.succeed(false),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );

  it.effect("never consults the resolver registry", () =>
    Authz.hasPermissions("testPlatform", Actions.Read).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: () => Effect.succeed(false),
            update: () => Effect.succeed(false),
            create: () => Effect.succeed(false),
            platformRead: () => Effect.succeed(true),
            thingById: () => Effect.die("resolver must not run for an unscoped resource"),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );
});

describe("Authz.hasPermissions (scoped resource — every action carries an id)", () => {
  it.effect("resolves the resource and threads it to the registered policy", () =>
    Authz.hasPermissions("test", Actions.Read, knownThing.id).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: (_caller, resource) => Effect.succeed(resource.id === knownThing.id),
            update: () => Effect.succeed(false),
            create: () => Effect.succeed(false),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );

  it.effect("resolves the resource for CREATE too, so a create can be scoped to its parent", () =>
    Authz.hasPermissions("test", Actions.Create, knownThing.id).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: () => Effect.succeed(false),
            update: () => Effect.succeed(false),
            create: (_caller, resource) => Effect.succeed(resource.id === knownThing.id),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );

  it.effect("propagates NotFound when the resource resolver reports NotFound", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Authz.hasPermissions("test", Actions.Read, "missing-thing" as ThingId),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof CustomHttpApiError.NotFound, true);
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: () => Effect.succeed(true),
            update: () => Effect.succeed(true),
            create: () => Effect.succeed(true),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );

  // Authorization touches the store twice — resolving the resource, then running
  // the check — and a transient outage in either is the same outage. Both must
  // arrive as the same failure, or the status a caller sees would depend on which
  // of the two steps happened to reach the store first.
  it.effect("propagates PersistenceUnavailable from the resource resolver", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Authz.hasPermissions("test", Actions.Read, knownThing.id));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.hasDies(exit.cause), false);
        const error = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
        deepStrictEqual(error instanceof PersistenceUnavailable, true);
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: () => Effect.succeed(true),
            update: () => Effect.succeed(true),
            create: () => Effect.succeed(true),
            thingById: () => new PersistenceUnavailable({ message: "connection lost" }),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );

  it.effect("propagates PersistenceUnavailable from the policy check", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Authz.hasPermissions("test", Actions.Read, knownThing.id));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.hasDies(exit.cause), false);
        const error = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
        deepStrictEqual(error instanceof PersistenceUnavailable, true);
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: () => new PersistenceUnavailable({ message: "connection lost" }),
            update: () => Effect.succeed(true),
            create: () => Effect.succeed(true),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );

  it.effect("fails Forbidden when the registered policy returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Authz.hasPermissions("test", Actions.Update, knownThing.id));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Forbidden, true);
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            read: () => Effect.succeed(true),
            update: () => Effect.succeed(false),
            create: () => Effect.succeed(false),
          }),
          provideCurrentUser(callerMember),
        ),
      ),
    ),
  );
});
