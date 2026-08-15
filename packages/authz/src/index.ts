// The one function an inbound adapter calls. `makeHasPermissions` is where a
// host pins the two things the DSL cannot supply for itself — the identity Tag
// to read the caller from, and the error a denial becomes — so that the library
// never names an HTTP status or a session type.
export { type AuthzAdapter, makeHasPermissions } from "./authz.js";

// The type-level seam. A host augments `AuthzConfig` once to say who the caller
// is, what a check may fail with, how a resolver reports absence, and which
// verbs a policy may be keyed on; the four aliases are what the rest of this
// package is written against. The action vocabulary is deliberately the host's:
// whether authorization is modelled as CRUD or as domain-specific verbs is a
// modelling decision, not something a mechanism should decide.
export {
  type Action,
  type AuthzConfig,
  type Caller,
  type CheckFailure,
  type ResourceMissing,
} from "./config.js";

// Boolean predicates over `(caller, resource)`, and the OR / AND combinators
// that compose them before the single lift to a denial at the boundary.
// `CallerCheck` is re-exported flat because a check that inspects only the
// caller is declared at that narrower arity to serve both scoped and unscoped
// resources.
export * as Check from "./check.js";
export { type CallerCheck } from "./check.js";

// Which checks answer for which (resource, action). `PolicyMap` is the
// declaration-merged seam; everything else here is what a module writes at its
// registration site, or what the composition root folds the contributions with.
export {
  type ActionFor,
  type CheckFor,
  type CheckOrArray,
  makePolicyRegistry,
  type PolicyContribution,
  type PolicyMap,
  PolicyRegistry,
  type PolicyResource,
  type ResourceCheck,
  type UnscopedCheck,
} from "./policy-registry.js";

// How a scoped resource is loaded before its checks run. Registration in
// `ResourceResolverMap` is also the switch that decides whether a resource
// takes an id at all — scopedness is a property of the resource, not the action.
export {
  type IdFor,
  makeResourceResolverRegistry,
  type NotFoundFor,
  type Resolver,
  type ResourceName,
  type ResourceResolverMap,
  ResourceResolverRegistry,
  type ResourceTypeFor,
} from "./resource-resolver-registry.js";
