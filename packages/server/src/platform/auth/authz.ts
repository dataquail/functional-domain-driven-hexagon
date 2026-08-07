import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import { type PersistenceUnavailable } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { type ActionFor, PolicyRegistry, type PolicyResource } from "./policy-registry.js";
import {
  type IdFor,
  type NotFoundFor,
  type ResourceName,
  ResourceResolverRegistry,
} from "./resource-resolver-registry.js";

// Endpoint-facing API. Mirrors jaclp's `hasPermission(resource, action, id)`.
//
// The resource decides whether an id is taken, on every action:
//   - Scoped resource (registered in `ResourceResolverMap`): id is
//     REQUIRED. The framework loads the resource via the registered
//     resolver and hands it to the check, so a check can never receive
//     `undefined`. Resource-not-found propagates as `NotFound`, which the
//     endpoint translates to a domain-specific `*NotFoundError`.
//   - Unscoped resource (absent from that map): id is FORBIDDEN, no
//     resolver runs, and `NotFound` is absent from the error channel — so
//     an unscoped call site has no unreachable branch to defend against.
//
// A policy returning `false` becomes `Forbidden` in either case.
//
// Variadic-tuple shape on the third arg gives clearer TS errors than
// overloads would: missing-id mistakes turn into "Expected 3 arguments,
// but got 2," not "not assignable to type 'never'."

type IdArgsFor<R extends PolicyResource> = R extends ResourceName ? [id: IdFor<R>] : [];

type ErrorsFor<R extends PolicyResource> = R extends ResourceName
  ? CustomHttpApiError.Forbidden | PersistenceUnavailable | NotFoundFor<R>
  : CustomHttpApiError.Forbidden | PersistenceUnavailable;

export const hasPermissions = <R extends PolicyResource, A extends ActionFor<R>>(
  resource: R,
  action: A,
  ...args: IdArgsFor<R>
): Effect.Effect<void, ErrorsFor<R>, CurrentUser | PolicyRegistry | ResourceResolverRegistry> =>
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
      return yield* new CustomHttpApiError.Forbidden({
        message: `Not permitted: ${String(resource)}.${String(action)}`,
      });
    }
  }).pipe(
    Effect.withSpan(`authz.hasPermissions.${String(resource)}.${String(action)}`),
    // The body's error union is the widest case (`NotFound` included). The
    // runtime `id !== undefined` branch above IS the scoped/unscoped split
    // that `ErrorsFor` keys on, so `NotFound` is only reachable when
    // `R extends ResourceName` — which TS can't verify through the erased
    // name-keyed resolver lookup.
    (effect) => effect as Effect.Effect<void, ErrorsFor<R>, never>,
  );
