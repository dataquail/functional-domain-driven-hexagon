import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { type CurrentUser, CurrentUser as CurrentUserTag } from "@org/contracts/Policy";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { UserId } from "@/platform/ids/user-id.js";
import { makeMembershipServiceFake } from "@/test-utils/membership-service-fake.js";
import { makeOrganizationRoleServiceFake } from "@/test-utils/organization-role-service-fake.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

import { Actions } from "./actions.js";
import * as Authz from "./authz.js";
import { type CheckFor, makePolicyRegistry } from "./policy-registry.js";
import { makeResourceResolverRegistry } from "./resource-resolver-registry.js";

// Synthetic registry entries scoped to this test file via declaration
// merging. Real module entries live in `modules/<m>/policies/*-policies.ts`.
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
      read: CheckFor<"test", "read">;
      update: CheckFor<"test", "update">;
      create: CheckFor<"test", "create">;
    };
  }
}

const callerMember: CurrentUser["Service"] = {
  sessionId: "s",
  userId: UserId.make("11111111-1111-1111-1111-111111111111"),
};

const knownThing: Thing = { id: "thing-1" as ThingId, ownerId: "u1" };

const provideRegistries = (opts: {
  readonly read: CheckFor<"test", "read">;
  readonly update: CheckFor<"test", "update">;
  readonly create: CheckFor<"test", "create">;
  readonly thingById?: (id: ThingId) => Effect.Effect<Thing, CustomHttpApiError.NotFound>;
}) =>
  Layer.mergeAll(
    makePolicyRegistry([
      {
        test: {
          read: opts.read,
          update: opts.update,
          create: opts.create,
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
    // `Authz.hasPermissions` reaches `RoleService` + `MembershipService`
    // (the platform-layer ACLs); none of the synthetic checks below
    // consume them, but the R channel still needs satisfying.
    makeRoleServiceFake(new Map()),
    makeMembershipServiceFake(),
    makeOrganizationRoleServiceFake(),
  );

const provideCurrentUser = (caller: CurrentUser["Service"]) => Layer.succeed(CurrentUserTag, caller);

describe("makePolicyRegistry — array-of-checks AND composition", () => {
  it.effect("succeeds only when every check in the array returns true", () =>
    Authz.hasPermissions("test", Actions.Read, knownThing.id).pipe(
      Effect.provide(
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
          makeRoleServiceFake(new Map()),
          makeMembershipServiceFake(),
          makeOrganizationRoleServiceFake(),
        ),
      ),
      Effect.provide(provideCurrentUser(callerMember)),
    ),
  );

  it.effect("fails Forbidden as soon as any check in the array returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Authz.hasPermissions("test", Actions.Read, knownThing.id));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Forbidden, true);
      }
    }).pipe(
      Effect.provide(
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
          makeRoleServiceFake(new Map()),
          makeMembershipServiceFake(),
          makeOrganizationRoleServiceFake(),
        ),
      ),
      Effect.provide(provideCurrentUser(callerMember)),
    ),
  );
});

describe("Authz.hasPermissions (flat — CREATE, no resource)", () => {
  it.effect("succeeds when the registered policy returns true", () =>
    Authz.hasPermissions("test", Actions.Create).pipe(
      Effect.provide(
        provideRegistries({
          read: () => Effect.succeed(false),
          update: () => Effect.succeed(false),
          create: () => Effect.succeed(true),
        }),
      ),
      Effect.provide(provideCurrentUser(callerMember)),
    ),
  );

  it.effect("fails Forbidden when the registered policy returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Authz.hasPermissions("test", Actions.Create));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Forbidden, true);
      }
    }).pipe(
      Effect.provide(
        provideRegistries({
          read: () => Effect.succeed(true),
          update: () => Effect.succeed(true),
          create: () => Effect.succeed(false),
        }),
      ),
      Effect.provide(provideCurrentUser(callerMember)),
    ),
  );
});

describe("Authz.hasPermissions (resource-scoped — READ/UPDATE/DELETE)", () => {
  it.effect("resolves the resource and threads it to the registered policy", () =>
    Authz.hasPermissions("test", Actions.Read, knownThing.id).pipe(
      Effect.provide(
        provideRegistries({
          read: (_caller, resource) => Effect.succeed(resource.id === knownThing.id),
          update: () => Effect.succeed(false),
          create: () => Effect.succeed(false),
        }),
      ),
      Effect.provide(provideCurrentUser(callerMember)),
    ),
  );

  it.effect("propagates NotFound when the resource resolver reports NotFound", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Authz.hasPermissions("test", Actions.Read, "missing-thing" as ThingId),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof CustomHttpApiError.NotFound, true);
      }
    }).pipe(
      Effect.provide(
        provideRegistries({
          read: () => Effect.succeed(true),
          update: () => Effect.succeed(true),
          create: () => Effect.succeed(true),
        }),
      ),
      Effect.provide(provideCurrentUser(callerMember)),
    ),
  );

  it.effect("fails Forbidden when the registered policy returns false", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Authz.hasPermissions("test", Actions.Update, knownThing.id));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Forbidden, true);
      }
    }).pipe(
      Effect.provide(
        provideRegistries({
          read: () => Effect.succeed(true),
          update: () => Effect.succeed(false),
          create: () => Effect.succeed(false),
        }),
      ),
      Effect.provide(provideCurrentUser(callerMember)),
    ),
  );
});
