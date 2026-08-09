import { type CurrentUser } from "@org/contracts/Policy";
import { type PersistenceUnavailable } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type Action } from "./actions.js";
import { type ResourceName, type ResourceTypeFor } from "./resource-resolver-registry.js";

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

// Must stay an `interface` (declaration merging does not work on `type`); the
// lint rules that would fight the empty interface and rewrite it to `type` are
// disabled for the registry seam files in .oxlintrc.json.
export interface PolicyMap {}

export type PolicyResource = keyof PolicyMap;
export type ActionFor<R extends PolicyResource> = keyof PolicyMap[R] & Action;

// Checks on a scoped resource receive the resolved resource; checks on an
// unscoped resource only see the current user. Both are fully closed: a module
// needing cross-module data closes over its own ACL port at registration rather
// than reaching a shared service through the environment. That is what keeps
// `R = never`, and what lets a policy unit test provide nothing at all.
export type ResourceCheck<Resource> = (
  caller: CurrentUser["Service"],
  resource: Resource,
) => Effect.Effect<boolean, PolicyErrors, never>;

export type UnscopedCheck = (
  caller: CurrentUser["Service"],
) => Effect.Effect<boolean, PolicyErrors, never>;

// Per-resource callback type. Registration in `ResourceResolverMap` is the
// switch: a resource with a resolver always hands its resolved value to the
// check, one without never does. The action does not enter into it.
export type CheckFor<R extends PolicyResource> = R extends ResourceName
  ? ResourceCheck<ResourceTypeFor<R>>
  : UnscopedCheck;

// At the registration site, a policy entry may be a single check or an
// array of checks. Arrays are AND-composed: every check must return
// true for the action to be allowed (short-circuits on the first
// false). For OR-composition, wrap with `Check.any(...)` from
// `./check.js`. Stacking checks like
//   update: [SuperAdminOnly, NotRecentlyPromoted]
// keeps the call site readable as checks grow.
export type CheckOrArray<R extends PolicyResource> = CheckFor<R> | ReadonlyArray<CheckFor<R>>;

// Module contributions are typed as a partial nested object — modules
// only fill in entries for resources/actions they own.
export type PolicyContribution = {
  readonly [R in PolicyResource]?: {
    readonly [A in ActionFor<R>]?: CheckOrArray<R>;
  };
};

// Internal lookup signature — returns whatever check was registered
// for `(resource, action)`. The Authz API narrows the result to the
// correct shape based on whether the action is flat or scoped.
type AnyRegisteredCheck = (
  caller: CurrentUser["Service"],
  resource?: unknown,
) => Effect.Effect<boolean, PolicyErrors, never>;

export class PolicyRegistry extends Context.Service<
  PolicyRegistry,
  {
    readonly get: <R extends PolicyResource, A extends ActionFor<R>>(
      resource: R,
      action: A,
    ) => AnyRegisteredCheck | undefined;
  }
>()("PolicyRegistry") {}

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
