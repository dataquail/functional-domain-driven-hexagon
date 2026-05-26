import { type CurrentUser } from "@org/contracts/Policy";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type MembershipService } from "@/platform/ddd/membership-service.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type RoleService } from "@/platform/ddd/role-service.js";

import { type Action, type FlatAction } from "./actions.js";
import { type ResourceName, type ResourceTypeFor } from "./resource-resolver-registry.js";

// Closed set of cross-cutting services a registered check may depend
// on. Today: `RoleService` (the platform-layer ACL over the role
// module) + `MembershipService` (the platform-layer ACL over the org
// module's memberships). Both are platform/ddd/ shaped services, never
// the source module's domain types — keeps consuming policies decoupled
// and keeps the dep graph acyclic.
export type PolicyDeps = RoleService | MembershipService;
export type PolicyErrors = PersistenceUnavailable;

// Registry of policy checks, keyed by (resource, action). Actions are
// the platform-wide CRUD verbs from `actions.ts`. Each module registers
// the subset of (resource, action) pairs it owns; the check callback
// encapsulates all the nuance — owner-vs-admin, scoped grants, etc.
//
// Modules extend `PolicyMap` via declaration merging from their
// per-module `policies/<module>-policies.ts` files. The composition
// root Layer-merges the per-module contributions into a single
// registry.

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface PolicyMap {}

export type PolicyResource = keyof PolicyMap;
export type ActionFor<R extends PolicyResource> = keyof PolicyMap[R] & Action;

// Resource-scoped checks receive the resolved resource; flat checks
// (CREATE) only see the current user. Both may reach the closed
// `PolicyDeps` set (RoleService etc.) and fail with `PolicyErrors`
// (PersistenceUnavailable).
export type ResourceCheck<R> = (
  caller: CurrentUser["Type"],
  resource: R,
) => Effect.Effect<boolean, PolicyErrors, PolicyDeps>;

export type FlatCheck = (
  caller: CurrentUser["Type"],
) => Effect.Effect<boolean, PolicyErrors, PolicyDeps>;

// Per-(resource, action) callback type. CREATE is flat (no resource
// load); READ/UPDATE/DELETE pass the resolved resource to the check.
export type CheckFor<R extends PolicyResource, A extends ActionFor<R>> = A extends FlatAction
  ? FlatCheck
  : R extends ResourceName
    ? ResourceCheck<ResourceTypeFor<R>>
    : never;

// At the registration site, a policy entry may be a single check or an
// array of checks. Arrays are AND-composed: every check must return
// true for the action to be allowed (short-circuits on the first
// false). For OR-composition, wrap with `Check.any(...)` from
// `./check.js`. Stacking checks like
//   update: [SuperAdminOnly, NotRecentlyPromoted]
// keeps the call site readable as checks grow.
export type CheckOrArray<R extends PolicyResource, A extends ActionFor<R>> =
  | CheckFor<R, A>
  | ReadonlyArray<CheckFor<R, A>>;

// Module contributions are typed as a partial nested object — modules
// only fill in entries for resources/actions they own.
export type PolicyContribution = {
  readonly [R in PolicyResource]?: {
    readonly [A in ActionFor<R>]?: CheckOrArray<R, A>;
  };
};

// Internal lookup signature — returns whatever check was registered
// for `(resource, action)`. The Authz API narrows the result to the
// correct shape based on whether the action is flat or scoped.
type AnyRegisteredCheck = (
  caller: CurrentUser["Type"],
  resource?: unknown,
) => Effect.Effect<boolean, PolicyErrors, PolicyDeps>;

export class PolicyRegistry extends Context.Tag("PolicyRegistry")<
  PolicyRegistry,
  {
    readonly get: <R extends PolicyResource, A extends ActionFor<R>>(
      resource: R,
      action: A,
    ) => AnyRegisteredCheck | undefined;
  }
>() {}

// Compose an array of checks into a single AND-composed check.
// Variadic across flat (1-arg) and resource-scoped (2-arg) shapes —
// the second arg is passed through and ignored by flat checks. Short
// -circuits on the first false.
const composeAnd =
  (checks: ReadonlyArray<AnyRegisteredCheck>): AnyRegisteredCheck =>
  (caller, resource) =>
    Effect.gen(function* () {
      for (const check of checks) {
        const allowed = yield* check(caller, resource);
        if (!allowed) return false;
      }
      return true;
    });

export const makePolicyRegistry = (
  contributions: ReadonlyArray<PolicyContribution>,
): Layer.Layer<PolicyRegistry> => {
  // Flatten into a single 2-level map for O(1) lookup. Multiple
  // contributions for the same (R, A) is an error — modules shouldn't
  // overlap and the merge collapsing would otherwise silently drop
  // policies.
  const flat = new Map<string, AnyRegisteredCheck>();
  for (const contrib of contributions) {
    for (const [resource, actions] of Object.entries(contrib)) {
      for (const [action, value] of Object.entries(actions as Record<string, unknown>)) {
        const key = `${resource}.${action}`;
        if (flat.has(key)) {
          throw new Error(`PolicyRegistry: duplicate policy for "${key}"`);
        }
        const stored = Array.isArray(value)
          ? composeAnd(value as ReadonlyArray<AnyRegisteredCheck>)
          : (value as AnyRegisteredCheck);
        flat.set(key, stored);
      }
    }
  }
  return Layer.succeed(PolicyRegistry, {
    get: (resource, action) => flat.get(`${String(resource)}.${String(action)}`),
  });
};
