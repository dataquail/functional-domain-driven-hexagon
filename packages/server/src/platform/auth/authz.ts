import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

import { type FlatAction } from "./actions.js";
import {
  type ActionFor,
  type PolicyDeps,
  PolicyRegistry,
  type PolicyResource,
} from "./policy-registry.js";
import {
  type IdFor,
  type ResourceName,
  ResourceResolverRegistry,
} from "./resource-resolver-registry.js";

// Endpoint-facing API. Mirrors jaclp's `hasPermission(resource, action,
// id?)`.
//
// id semantics by action type:
//   - CREATE (FlatAction):  id forbidden (no record exists yet).
//   - READ / UPDATE / DELETE: id optional. Pass it when the registered
//     check needs to inspect the resource (OwnerOf, MemberHasGrant,
//     IsSelf, etc.) — the framework loads it via the registered
//     resolver and hands it to the check. Omit it when the check only
//     inspects the caller (SuperAdminOnly is the canonical example) —
//     no DB round trip, no 404 surface for ids the caller might not be
//     allowed to see.
//
// Resource-not-found at the resolver propagates as `NotFound` — the
// endpoint translates it to a domain-specific `*NotFoundError`. A
// policy returning `false` becomes `Forbidden`.
//
// Variadic-tuple shape on the third arg gives clearer TS errors than
// overloads would: missing-id mistakes turn into "Argument of type X
// is not assignable to parameter of type Y," not "not assignable to
// type 'never'."

type IdArgsFor<R extends PolicyResource, A extends ActionFor<R>> = A extends FlatAction
  ? []
  : R extends ResourceName
    ? [id?: IdFor<R>]
    : never;

export const hasPermissions = <R extends PolicyResource, A extends ActionFor<R>>(
  resource: R,
  action: A,
  ...args: IdArgsFor<R, A>
): Effect.Effect<
  void,
  CustomHttpApiError.Forbidden | CustomHttpApiError.NotFound | PersistenceUnavailable,
  CurrentUser | PolicyRegistry | ResourceResolverRegistry | PolicyDeps
> =>
  Effect.gen(function* () {
    const caller = yield* CurrentUser;
    const registry = yield* PolicyRegistry;
    const check = registry.get(resource, action);
    if (check === undefined) {
      return yield* Effect.die(
        `PolicyRegistry: no policy registered for "${String(resource)}.${String(action)}"`,
      );
    }

    // Erase the per-call generics for the runtime lookup: the resolver
    // is a name-keyed map (`Map<string, fn>` under the hood) and the
    // variadic-tuple input type already guarantees `(resource, id)` are
    // a valid pair at the call site. With multiple registered resources
    // `IdFor<R>` widens to a union of brands; the cast on `id` says
    // "this id belongs to *this* resource" — TS can't track that
    // through the erased pair lookup.
    type AnyResource = PolicyResource & ResourceName;
    const id = (args as ReadonlyArray<unknown>)[0] as IdFor<AnyResource> | undefined;
    let loaded: unknown = undefined;
    if (id !== undefined) {
      const resolvers = yield* ResourceResolverRegistry;
      // `resolve(R, IdFor<R>)` doesn't see the connection between
      // `id`'s widened union brand and the specific `resource` we have
      // here. The cast forces them into the same `AnyResource` slot —
      // sound because the variadic-tuple input already guarantees the
      // pair at the call site.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      loaded = yield* resolvers.resolve(resource as AnyResource, id);
    }

    const allowed = yield* check(caller, loaded);
    if (!allowed) {
      return yield* Effect.fail(
        new CustomHttpApiError.Forbidden({
          message: `Not permitted: ${String(resource)}.${String(action)}`,
        }),
      );
    }
  }).pipe(Effect.withSpan(`authz.hasPermissions.${String(resource)}.${String(action)}`));
