import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { makeHasPermissions } from "./authz.js";
import { type CheckFor, makePolicyRegistry } from "./policy-registry.js";
import { makeResourceResolverRegistry } from "./resource-resolver-registry.js";

// A synthetic host, declared here so the package's own suite exercises the same
// seam a real one configures: an identity, a transient-store failure, an
// absence signal, an action vocabulary, and a denial. Only one host can be
// configured per TypeScript program, so this augmentation is the whole
// package's caller shape.
//
// The vocabulary is deliberately NOT the CRUD set — it is a host's modelling
// decision, and picking domain verbs here is what proves the library holds no
// opinion about it.
const Actions = {
  View: "view",
  Publish: "publish",
  Archive: "archive",
} as const;

type HostAction = (typeof Actions)[keyof typeof Actions];

class StoreUnavailable extends Schema.TaggedErrorClass<StoreUnavailable>()("StoreUnavailable", {
  message: Schema.String,
}) {}

class ResourceGone extends Schema.TaggedErrorClass<ResourceGone>()("ResourceGone", {}) {}

class Denied extends Schema.TaggedErrorClass<Denied>()("Denied", {
  message: Schema.String,
}) {}

class CurrentCaller extends Context.Service<CurrentCaller, { readonly userId: string }>()(
  "CurrentCaller",
) {}

declare module "./config.js" {
  interface AuthzConfig {
    caller: CurrentCaller["Service"];
    checkFailure: StoreUnavailable;
    resourceMissing: ResourceGone;
    action: HostAction;
  }
}

// Synthetic registry entries scoped to this program via declaration merging.
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
      view: CheckFor<"test">;
      publish: CheckFor<"test">;
      archive: CheckFor<"test">;
    };
    testPlatform: {
      view: CheckFor<"testPlatform">;
    };
  }
}

const hasPermissions = makeHasPermissions({
  caller: CurrentCaller,
  forbidden: (message) => new Denied({ message }),
});

const callerMember: CurrentCaller["Service"] = { userId: "u1" };

const knownThing: Thing = { id: "thing-1" as ThingId, ownerId: "u1" };

const provideRegistries = (opts: {
  readonly view: CheckFor<"test">;
  readonly publish: CheckFor<"test">;
  readonly archive: CheckFor<"test">;
  readonly platformView?: CheckFor<"testPlatform">;
  readonly thingById?: (id: ThingId) => Effect.Effect<Thing, ResourceGone | StoreUnavailable>;
}) =>
  Layer.mergeAll(
    makePolicyRegistry([
      {
        test: {
          view: opts.view,
          publish: opts.publish,
          archive: opts.archive,
        },
        testPlatform: {
          view: opts.platformView ?? (() => Effect.succeed(false)),
        },
      },
    ]),
    makeResourceResolverRegistry({
      test:
        opts.thingById ??
        ((id) => (id === knownThing.id ? Effect.succeed(knownThing) : new ResourceGone())),
    }),
  );

const provideCaller = (caller: CurrentCaller["Service"]) => Layer.succeed(CurrentCaller, caller);

const failureOf = <A, E>(exit: Exit.Exit<A, E>): E | null =>
  Exit.isFailure(exit) && Cause.hasFails(exit.cause)
    ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
    : null;

describe("makePolicyRegistry — array-of-checks AND composition", () => {
  it.effect("succeeds only when every check in the array returns true", () =>
    hasPermissions("test", Actions.View, knownThing.id).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.mergeAll(
            makePolicyRegistry([
              {
                test: {
                  view: [() => Effect.succeed(true), () => Effect.succeed(true)],
                  publish: () => Effect.succeed(false),
                  archive: () => Effect.succeed(false),
                },
              },
            ]),
            makeResourceResolverRegistry({
              test: () => Effect.succeed(knownThing),
            }),
          ),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  it.effect("fails the denial as soon as any check in the array returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(hasPermissions("test", Actions.View, knownThing.id));
      deepStrictEqual(Exit.isFailure(exit), true);
      deepStrictEqual(failureOf(exit) instanceof Denied, true);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.mergeAll(
            makePolicyRegistry([
              {
                test: {
                  view: [
                    () => Effect.succeed(true),
                    () => Effect.succeed(false), // second check fails — overall denial
                    () => Effect.die("should have short-circuited"),
                  ],
                  publish: () => Effect.succeed(false),
                  archive: () => Effect.succeed(false),
                },
              },
            ]),
            makeResourceResolverRegistry({
              test: () => Effect.succeed(knownThing),
            }),
          ),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  // Two contributions claiming the same pair would silently collapse to one
  // when the maps merge, dropping a policy a module believes it registered.
  it("throws when two contributions register the same (resource, action)", () => {
    let thrown: unknown = null;
    try {
      makePolicyRegistry([
        { test: { view: () => Effect.succeed(true) } },
        { test: { view: () => Effect.succeed(false) } },
      ]);
    } catch (error) {
      thrown = error;
    }
    deepStrictEqual(thrown instanceof Error, true);
    deepStrictEqual((thrown as Error).message, 'PolicyRegistry: duplicate policy for "test.view"');
  });
});

// The host's vocabulary is what closes the action set. Without the `action` slot
// every key a resource happens to register would stand on its own; with it, a
// verb outside the declared union is rejected at the call site even when the
// registry has an entry under that key. Asserted at compile time, because there
// is no runtime moment at which a mistyped action exists.
describe("the host's action vocabulary constrains the call site", () => {
  it("rejects a verb outside the declared union", () => {
    const rejected = () =>
      // @ts-expect-error "delete" is not in this host's vocabulary
      hasPermissions("test", "delete", knownThing.id);
    deepStrictEqual(typeof rejected, "function");
  });
});

describe("makeResourceResolverRegistry", () => {
  // A scoped resource with no registered resolver is a wiring mistake, not a
  // request the caller can fix — so it dies rather than joining the failure
  // channel every call site has to handle.
  it.effect("dies when a scoped resource has no registered resolver", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(hasPermissions("test", Actions.View, knownThing.id)).pipe(
        Effect.provide(
          Layer.mergeAll(
            makePolicyRegistry([
              {
                test: {
                  view: () => Effect.succeed(true),
                  publish: () => Effect.succeed(true),
                  archive: () => Effect.succeed(true),
                },
              },
            ]),
            makeResourceResolverRegistry({}),
            provideCaller(callerMember),
          ),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.hasDies(exit.cause), true);
      }
    }),
  );
});

describe("hasPermissions (unscoped resource — takes no id)", () => {
  it.effect("succeeds when the registered policy returns true", () =>
    hasPermissions("testPlatform", Actions.View).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: () => Effect.succeed(false),
            publish: () => Effect.succeed(false),
            archive: () => Effect.succeed(false),
            platformView: () => Effect.succeed(true),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  it.effect("fails the denial when the registered policy returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(hasPermissions("testPlatform", Actions.View));
      deepStrictEqual(Exit.isFailure(exit), true);
      deepStrictEqual(failureOf(exit) instanceof Denied, true);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: () => Effect.succeed(true),
            publish: () => Effect.succeed(true),
            archive: () => Effect.succeed(true),
            platformView: () => Effect.succeed(false),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  it.effect("never consults the resolver registry", () =>
    hasPermissions("testPlatform", Actions.View).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: () => Effect.succeed(false),
            publish: () => Effect.succeed(false),
            archive: () => Effect.succeed(false),
            platformView: () => Effect.succeed(true),
            thingById: () => Effect.die("resolver must not run for an unscoped resource"),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );
});

describe("hasPermissions (scoped resource — every action carries an id)", () => {
  it.effect("resolves the resource and threads it to the registered policy", () =>
    hasPermissions("test", Actions.View, knownThing.id).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: (_caller, resource) => Effect.succeed(resource.id === knownThing.id),
            publish: () => Effect.succeed(false),
            archive: () => Effect.succeed(false),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  it.effect("resolves the resource for CREATE too, so a create can be scoped to its parent", () =>
    hasPermissions("test", Actions.Archive, knownThing.id).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: () => Effect.succeed(false),
            publish: () => Effect.succeed(false),
            archive: (_caller, resource) => Effect.succeed(resource.id === knownThing.id),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  it.effect("propagates the absence signal when the resource resolver reports it", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        hasPermissions("test", Actions.View, "missing-thing" as ThingId),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      deepStrictEqual(failureOf(exit) instanceof ResourceGone, true);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: () => Effect.succeed(true),
            publish: () => Effect.succeed(true),
            archive: () => Effect.succeed(true),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  // Authorization touches the store twice — resolving the resource, then running
  // the check — and a transient outage in either is the same outage. Both must
  // arrive as the same failure, or the status a caller sees would depend on which
  // of the two steps happened to reach the store first.
  it.effect("propagates the check failure from the resource resolver", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(hasPermissions("test", Actions.View, knownThing.id));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.hasDies(exit.cause), false);
      }
      deepStrictEqual(failureOf(exit) instanceof StoreUnavailable, true);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: () => Effect.succeed(true),
            publish: () => Effect.succeed(true),
            archive: () => Effect.succeed(true),
            thingById: () => new StoreUnavailable({ message: "connection lost" }),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  it.effect("propagates the check failure from the policy check", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(hasPermissions("test", Actions.View, knownThing.id));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.hasDies(exit.cause), false);
      }
      deepStrictEqual(failureOf(exit) instanceof StoreUnavailable, true);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: () => new StoreUnavailable({ message: "connection lost" }),
            publish: () => Effect.succeed(true),
            archive: () => Effect.succeed(true),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );

  it.effect("fails the denial when the registered policy returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(hasPermissions("test", Actions.Publish, knownThing.id));
      deepStrictEqual(Exit.isFailure(exit), true);
      deepStrictEqual(failureOf(exit) instanceof Denied, true);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          provideRegistries({
            view: () => Effect.succeed(true),
            publish: () => Effect.succeed(false),
            archive: () => Effect.succeed(false),
          }),
          provideCaller(callerMember),
        ),
      ),
    ),
  );
});
