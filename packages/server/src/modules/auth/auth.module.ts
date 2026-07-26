import * as Layer from "effect/Layer";

import { PlatformRolesLive } from "./infrastructure/acl/platform-roles.acl-live.js";
import { UserProvisioningLive } from "./infrastructure/acl/user-provisioning.acl-live.js";
import { OidcClient } from "./infrastructure/clients/oidc.client.js";
import { AuthIdentityRepositoryLive } from "./infrastructure/repositories/auth-identity.repository-live.js";
import { SessionRepositoryLive } from "./infrastructure/repositories/session.repository-live.js";
import { AuthLive } from "./interface/http/index.js";

// AuthModuleLive registers the HTTP handlers and the auth-only
// infrastructure they depend on. The OIDC client is private to the
// callback path; AuthIdentityRepository is read only by sign-in;
// SessionRepository is used by the logout endpoint directly (no bus
// dispatch) — all stay internal here.
//
// CookieCodec is the only auth-infra service still hoisted via
// `AuthSharedDepsLive` because the platform middleware verifies the
// session cookie with the same key the auth module signs with.
//
// `OidcClient` is consumed directly by the login/callback/logout endpoints,
// so `HttpApiBuilder` tracks it as a request-scoped requirement. In v4 that
// requirement is only satisfiable AFTER `HttpRouter.serve` unwraps it into a
// plain one — `HttpRouter.provideRequest` cannot reach routes registered
// through `HttpApiBuilder`'s group indirection (see OrganizationModuleLive
// for the full rationale). So the module publishes it as `AuthHttpDepsLive`
// and the composition root provides it post-serve. The repositories are
// reached through the bus, so their requirement is closed at build with
// `Layer.provide`.
export const AuthHttpDepsLive = OidcClient.layer;

// The JIT-provisioning adapter needs the buses and unit of work, which only
// the composition root has, so it cannot be closed here. It ships as a named
// module bundle instead of a barrel re-export because the adapter itself lives
// in `infrastructure/` and the barrel may not reach in there — same shape as
// `AuthHttpDepsLive`. Consumers see the bundle; the `UserProvisioning` Tag
// stays private to this module's use-case ring.
export const AuthProvisioningDepsLive = UserProvisioningLive;

// The role-lookup adapter behind `/auth/me`. Same reason as above: it dispatches
// through the QueryBus, so it cannot be closed inside the module, and it lives
// in `infrastructure/` so the barrel cannot re-export it directly.
export const AuthAclDepsLive = PlatformRolesLive;

export const AuthModuleLive = AuthLive.pipe(
  Layer.provide(AuthIdentityRepositoryLive),
  Layer.provide(SessionRepositoryLive),
);
