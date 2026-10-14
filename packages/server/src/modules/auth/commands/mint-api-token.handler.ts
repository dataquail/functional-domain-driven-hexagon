import { type PersistenceUnavailable, withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Hex from "effect/encoding/Hex";
import * as Option from "effect/Option";

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
// plaintext once. Random generation is the sole impure step (the `Crypto`
// service); formatting + hashing are pure domain helpers shared with
// the auth middleware's per-request lookup.
//
// Exposed sans-uow so a caller already inside a transaction (the device-flow
// poll) can mint + consume its grant atomically without nesting a second
// unit of work. `mintApiTokenHandler` adds the boundary for direct bus dispatch.
export const mintApiTokenCore = Effect.fnUntraced(function* (
  input: MintApiTokenInput,
): Effect.fn.Return<
  MintApiTokenResult,
  PersistenceUnavailable,
  ApiTokenRepository | Crypto.Crypto
> {
  const repo = yield* ApiTokenRepository;
  const crypto = yield* Crypto.Crypto;

  const publicId = Hex.encode(yield* Effect.orDie(crypto.randomBytes(4)));
  const secret = Base64Url.encode(yield* Effect.orDie(crypto.randomBytes(32)));

  const token = ApiTokenRootOps.assembleToken(publicId, secret);
  const id = ApiTokenId.make(yield* Effect.orDie(crypto.randomUUIDv4));
  const now = yield* DateTime.now;

  const apiToken = ApiTokenRootOps.mint({
    id,
    userId: input.userId,
    tokenHash: CredentialHash.of(token),
    prefix: ApiTokenRootOps.displayPrefix(publicId),
    label: input.label,
    now,
    expiresAt: Option.some(DateTime.add(now, { days: input.expiresInDays })),
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
