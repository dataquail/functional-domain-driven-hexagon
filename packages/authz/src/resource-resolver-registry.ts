import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type CheckFailure, type ResourceMissing } from "./config.js";

// Registry mapping a resource name (the "resource" half of a
// "resource.action" policy key) to a function that loads that resource
// by id. A host adds entries via declaration merging on
// `ResourceResolverMap`, and its composition root Layer-merges the
// resolvers into a single registry.

// A host contributes entries via declaration merging; this empty declaration is
// the seam it extends. It must stay an `interface` (declaration merging does not
// work on `type`); the lint rules that would fight the empty interface and
// rewrite it to `type` are disabled for the registry seam files in
// .oxlintrc.json.
export interface ResourceResolverMap {}

export type ResourceName = keyof ResourceResolverMap;

export type IdFor<R extends ResourceName> = ResourceResolverMap[R] extends {
  idType: infer I;
}
  ? I
  : never;

export type ResourceTypeFor<R extends ResourceName> = ResourceResolverMap[R] extends {
  resourceType: infer T;
}
  ? T
  : never;

// A resource declares whether resolving it can report absence. Most resources
// load a row and so can report `NotFound` (the default when the field is
// omitted). A resource whose identity IS its id — an "echo" resolver that has
// nothing to load — declares `notFound: never`, which removes `NotFound` from
// every call site's error channel, so there is no unreachable branch to defend
// against.
export type NotFoundFor<R extends ResourceName> = ResourceResolverMap[R] extends {
  notFound: infer N;
}
  ? N
  : ResourceMissing;

// The configured `CheckFailure` is in the channel regardless of `notFound`, and
// for the same reason a policy check may raise it: resolving a resource reads
// the store, and a transient outage there is the caller's problem to retry. A
// resolver that died on it instead would report a retryable outage as an
// internal error — while the identical outage one step later, inside the check
// or the use case, propagated as a failure.
export type Resolver<R extends ResourceName> = (
  id: IdFor<R>,
) => Effect.Effect<ResourceTypeFor<R>, NotFoundFor<R> | CheckFailure, never>;

type ResolversObject = { [R in ResourceName]: Resolver<R> };

export class ResourceResolverRegistry extends Context.Service<
  ResourceResolverRegistry,
  {
    readonly resolve: <R extends ResourceName>(
      resource: R,
      id: IdFor<R>,
    ) => Effect.Effect<ResourceTypeFor<R>, NotFoundFor<R> | CheckFailure, never>;
  }
>()("ResourceResolverRegistry") {}

// Builds a Layer that provides the registry from a plain object of
// resolvers. The composition root calls this with the union of every
// module's contributions; tests call it with a synthetic map.
export const makeResourceResolverRegistry = (
  resolvers: Partial<ResolversObject>,
): Layer.Layer<ResourceResolverRegistry> =>
  Layer.succeed(ResourceResolverRegistry, {
    resolve: <R extends ResourceName>(resource: R, id: IdFor<R>) => {
      const resolver = resolvers[resource];
      if (resolver === undefined) {
        return Effect.die(
          `ResourceResolverRegistry: no resolver registered for resource "${String(resource)}"`,
        );
      }
      return resolver(id);
    },
  });
