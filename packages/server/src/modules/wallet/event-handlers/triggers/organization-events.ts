// Wallet-internal trigger types — the shape `wallet` cares about when
// it reacts to events that originate in `organization`. Decouples the
// wallet's handlers from the org module's event schema: if `organization`
// adds fields to `OrganizationCreated`, the adapter absorbs the change
// here and the handlers stay stable.
//
// Per ADR-0007 + the ACL pattern: cross-module event consumption goes
// through an adapter that translates the publisher's event into the
// consumer's trigger type. See ../organization-event-adapter.ts.

import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

export const OrganizationCreatedTrigger = Schema.Struct({
  organizationId: OrganizationId,
});
export type OrganizationCreatedTrigger = typeof OrganizationCreatedTrigger.Type;
