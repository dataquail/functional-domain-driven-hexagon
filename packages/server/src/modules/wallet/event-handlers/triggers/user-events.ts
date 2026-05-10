// Wallet-internal trigger types — the shape `wallet` cares about when
// it reacts to events that originate in `user`. Decouples the
// wallet's handlers from the user module's event schema: if `user`
// adds fields to `UserCreated`, the adapter absorbs the change here
// and the handlers stay stable.
//
// Per ADR-0007 + the ACL pattern: cross-module event consumption goes
// through an adapter that translates the publisher's event into the
// consumer's trigger type. See ../user-event-adapter.ts.

import { UserId } from "@/platform/ids/user-id.js";
import * as Schema from "effect/Schema";

export const UserCreatedTrigger = Schema.Struct({
  userId: UserId,
});
export type UserCreatedTrigger = typeof UserCreatedTrigger.Type;
