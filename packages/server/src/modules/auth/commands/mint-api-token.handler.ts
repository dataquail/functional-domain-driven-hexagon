import { randomBytes, randomUUID } from "node:crypto";

import { type PersistenceUnavailable, withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type MintApiTokenInput,
  type MintApiTokenPayload,
  type MintApiTokenResult,
} from "@/modules/auth/commands/mint-api-token.command.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops.js";
import { CredentialHash } from "@/modules/auth/domain/domain-services/credential-hash.domain-service.js";

// Core mint, WITHOUT the unit-of-work boundary. Generates an opaque
// `pat_<publicId>_<secret>`, persists only its sha256 hash, and returns the
// plaintext once. Random generation is the sole impure step (kept in
// `Effect.sync`); formatting + hashing are pure domain helpers shared with
// the auth middleware's per-request lookup.
//
// Exposed sans-uow so a caller already inside a transaction (the device-flow
// poll) can mint + consume its grant atomically without nesting a second
// unit of work. `mintApiTokenHandler` adds the boundary for direct bus dispatch.
export const mintApiTokenCore = Effect.fnUntraced(function* (
  input: MintApiTokenInput,
): Effect.fn.Return<MintApiTokenResult, PersistenceUnavailable, ApiTokenRepository> {
  const repo = yield* ApiTokenRepository;
  const { publicId, secret } = yield* Effect.sync(() => ({
    publicId: randomBytes(4).toString("hex"),
    secret: randomBytes(32).toString("base64url"),
  }));
  const token = ApiTokenRootOps.assembleToken(publicId, secret);
  const id = ApiTokenId.make(yield* Effect.sync(() => randomUUID()));
  const now = yield* DateTime.now;
  const apiToken = ApiTokenRootOps.mint({
    id,
    userId: input.userId,
    tokenHash: CredentialHash.of(token),
    prefix: ApiTokenRootOps.displayPrefix(publicId),
    label: input.label,
    now,
    expiresAt: DateTime.add(now, { days: input.expiresInDays }),
  });
  yield* repo.insertOne(apiToken);
  yield* Effect.annotateCurrentSpan("user.id", input.userId);
  return { apiToken, token };
});

// The registered use case: `mintApiTokenCore` + the transaction boundary.
// `Effect.fn` names the use-case span (`mintApiTokenHandler`) inside the command-bus
// boundary span; `fnUntraced` above keeps the core span-less (a shared sub-step
// below use-case granularity) so its `annotateCurrentSpan` lands on whichever use
// case invoked it (this one, or `pollDeviceGrantHandler`).
export const mintApiTokenHandler = Effect.fn("mintApiTokenHandler")(function* (
  cmd: MintApiTokenPayload,
) {
  return yield* mintApiTokenCore(cmd);
}, withUnitOfWork);
