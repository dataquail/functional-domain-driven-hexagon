import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { AddressValueObject } from "./value-objects/address.value-object.js";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `user.root-ops.ts` (`UserRootOps`) and carry the test obligation.
export class UserRoot extends Schema.Class<UserRoot>("UserRoot")({
  id: UserId,
  email: Schema.String,
  // Nullable: a user provisioned just-in-time on first OIDC sign-in has no
  // address yet (only email + Zitadel subject are known). It's filled in
  // later via `updateAddress`.
  address: Schema.NullOr(AddressValueObject),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}
