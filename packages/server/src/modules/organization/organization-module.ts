import * as Layer from "effect/Layer";

import { MailerLive } from "@/platform/notifications/mailer-live.js";

import { InvitationMailerLive } from "./infrastructure/external/invitation-mailer-live.js";
import { OrganizationRepositoryLive } from "./infrastructure/organization-repository-live.js";
import {
  InvitationLive,
  OrganizationAdminLive,
  OrganizationLive,
} from "./interface/http/organization-live.js";

// `InvitationMailer` is the org module's outbound notification port
// (ADR-0023): the invite use case depends on it, and the adapter renders
// the React Email template + forwards to the platform `Mailer`. The
// env-selected transport (`MailerLive`: log/smtp/ses) is wired behind it
// here, so the `Mailer` Tag never leaves the module — same containment as
// `BillingGateway` inside `BillingModuleLive`. `MailerLive` still needs
// `EnvVars`, which is satisfied at the composition root.
const InvitationMailerProvided = InvitationMailerLive.pipe(Layer.provide(MailerLive));

export const OrganizationModuleLive = Layer.mergeAll(
  OrganizationLive,
  OrganizationAdminLive,
  InvitationLive,
).pipe(Layer.provide(OrganizationRepositoryLive), Layer.provide(InvitationMailerProvided));
