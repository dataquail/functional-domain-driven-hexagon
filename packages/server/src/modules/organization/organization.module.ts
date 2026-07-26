import * as Layer from "effect/Layer";

import { MailerLive } from "@/platform/notifications/mailer-live.js";

import { PlatformRolesLive } from "./infrastructure/acl/platform-roles.acl-live.js";
import { InvitationMailerLive } from "./infrastructure/clients/invitation-mailer.client-live.js";
import { OrganizationRepositoryLive } from "./infrastructure/repositories/organization.repository-live.js";
import { OrgCliLive } from "./interface/cli/index.js";
import { InvitationLive, OrganizationAdminLive, OrganizationLive } from "./interface/http/index.js";

// `InvitationMailer` is the org module's outbound notification port
// (ADR-0022): the invite use case depends on it, and the adapter renders
// the React Email template + forwards to the platform `Mailer`. The
// env-selected transport (`MailerLive`: log/smtp/ses) is wired behind it
// here, so the `Mailer` Tag never leaves the module. `MailerLive` still
// needs `EnvVars`, which is satisfied at the composition root.
//
// The invite command handler depends on `InvitationMailer`; that
// requirement reaches the endpoints (via the typed command bus) and
// `HttpApiBuilder` tracks it as a request-scoped requirement. In v4 such a
// requirement is only satisfiable AFTER `HttpRouter.serve` unwraps it into
// a plain one — `HttpRouter.provideRequest` cannot reach routes registered
// through `HttpApiBuilder`'s group indirection (its context-keyed
// middleware never lands in the context where the routes are added, so at
// runtime the service is missing even though the types line up). So the
// module publishes this dependency as an opaque bundled layer and the
// composition root provides it post-serve, exactly like the other app
// services; the `Mailer` Tag stays contained — the root only sees
// `OrganizationHttpDepsLive`.
export const OrganizationHttpDepsLive = InvitationMailerLive.pipe(Layer.provide(MailerLive));

// This module's outbound ACL adapters need the buses, which only the composition
// root has, so they cannot be closed here. They ship as a named module bundle
// rather than a barrel re-export because the adapters live in `infrastructure/`
// and the barrel may not reach in there — same shape as `OrganizationHttpDepsLive`.
// Both the policy checks and the "a super-admin cannot own an organization"
// use-case invariant read through them.
export const OrganizationAclDepsLive = PlatformRolesLive;

export const OrganizationModuleLive = Layer.mergeAll(
  OrganizationLive,
  OrganizationAdminLive,
  InvitationLive,
  // CLI-facing `listMine` (the `cliOrganization` group on CliApi).
  OrgCliLive,
).pipe(Layer.provide(OrganizationRepositoryLive));
