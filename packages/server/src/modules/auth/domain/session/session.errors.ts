import * as Schema from "effect/Schema";

import { SessionId } from "./session.id.js";

export class SessionNotFound extends Schema.TaggedError<
  SessionNotFound,
  { readonly brand: "SessionNotFound" }
>()("SessionNotFound", {
  sessionId: SessionId,
}) {}

export class SessionExpired extends Schema.TaggedError<
  SessionExpired,
  { readonly brand: "SessionExpired" }
>()("SessionExpired", {
  sessionId: SessionId,
}) {}

export class SessionRevoked extends Schema.TaggedError<
  SessionRevoked,
  { readonly brand: "SessionRevoked" }
>()("SessionRevoked", {
  sessionId: SessionId,
}) {}
