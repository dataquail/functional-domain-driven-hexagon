// The four host types this library is written against but does not own: who is
// asking, what a check or resolver may fail with, how a resolver reports
// absence, and the verbs a policy may be keyed on. A host declares them once by
// augmenting `AuthzConfig`:
//
//   import { type Action as AppAction } from "./actions.js";
//
//   declare module "@org/authz/config" {
//     interface AuthzConfig {
//       caller: CurrentUser["Service"];
//       checkFailure: PersistenceUnavailable;
//       resourceMissing: NotFound;
//       action: AppAction;
//     }
//   }
//
// Alias a host type whose name matches an alias below. An augmentation body
// resolves unqualified names in THIS module's scope, so a host type called
// `Action` would bind to the alias here and self-reference (TS2502).
//
// They arrive as an augmented interface rather than as generic parameters
// because the registries are themselves declaration-merged: a module writes
// `CheckFor<"todo">` at the type level, with no value to infer from. Threading
// four parameters through `PolicyMap`, `PolicyContribution` and `Resolver`
// would put them at every registration site instead of at the one place the
// host actually decides them.
//
// Must stay an `interface` (declaration merging does not work on `type`); the
// lint rules that would fight the empty interface and rewrite it to `type` are
// disabled for the registry seam files in .oxlintrc.json.
export interface AuthzConfig {}

// The identity a check interrogates. `never` when unconfigured, so a check body
// reaching for a field fails at the host's first check rather than silently
// typing it `unknown`.
export type Caller = AuthzConfig extends { caller: infer C } ? C : never;

// What a check or a resolver is allowed to fail with. Authorization reads the
// store twice — once to resolve the resource, once inside the check — and the
// same transient outage can strike either, so one type covers both.
export type CheckFailure = AuthzConfig extends { checkFailure: infer E } ? E : never;

// How a resolver reports "no such resource". The default for any resource that
// does not opt out with `notFound: never`.
export type ResourceMissing = AuthzConfig extends { resourceMissing: infer N } ? N : never;

// The closed set of verbs a policy may be keyed on, intersected with each
// resource's registered actions. Whether that set is CRUD, a richer
// domain-specific vocabulary, or per-resource verbs is the host's modelling
// decision — a library that shipped one would be imposing an authorization
// taxonomy, not providing a mechanism.
//
// Unconfigured it is `string`, which imposes nothing: every action a resource
// registers stands on its own. Declaring the slot is what turns a shared
// vocabulary into something the compiler holds every resource to.
export type Action = AuthzConfig extends { action: infer A } ? A : string;
