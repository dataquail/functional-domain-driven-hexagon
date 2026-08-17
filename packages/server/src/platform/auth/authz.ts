import { makeHasPermissions } from "@effect-server-utils/authz";
import { type PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";

// Aliased: an augmentation body resolves unqualified names in the target
// module's scope, where `Action` is the library's own alias for this slot.
import { type Action as AppAction } from "./actions.js";

// This application's half of `@effect-server-utils/authz`. The library owns the mechanism —
// the (resource, action) registry, per-request resource resolution, the check
// combinators — and names none of the five things below, so that it stays free
// of HTTP statuses, of this application's session shape, of `@effect-server-utils/cqrs`, and of
// any opinion about how authorization should be modelled.
//
// The four types are declared once here and reach every registration site
// through the library's own aliases. The denial is a value rather than a type,
// so it arrives as a constructor: a `Schema.TaggedErrorClass` instance is
// already a failed Effect, which is why the lambda needs no lifting.

declare module "@effect-server-utils/authz/config" {
  interface AuthzConfig {
    caller: CurrentUser["Service"];
    checkFailure: PersistenceUnavailable;
    resourceMissing: CustomHttpApiError.NotFound;
    action: AppAction;
  }
}

export const hasPermissions = makeHasPermissions({
  caller: CurrentUser,
  forbidden: (message) => new CustomHttpApiError.Forbidden({ message }),
});
