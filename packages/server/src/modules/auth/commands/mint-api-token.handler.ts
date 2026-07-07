import { randomBytes, randomUUID } from "node:crypto";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type MintApiTokenCommand,
  type MintApiTokenInput,
  type MintApiTokenOutput,
  type MintApiTokenResult,
} from "@/modules/auth/commands/mint-api-token.command.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token.id.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token.root.js";
import { CredentialHash } from "@/modules/auth/domain/credential-hash.domain-service.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Core mint, WITHOUT the unit-of-work boundary. Generates an opaque
// `pat_<publicId>_<secret>`, persists only its sha256 hash, and returns the
// plaintext once. Random generation is the sole impure step (kept in
// `Effect.sync`); formatting + hashing are pure domain helpers shared with
// the auth middleware's per-request lookup.
//
// Exposed sans-uow so a caller already inside a transaction (the device-flow
// poll) can mint + consume its grant atomically without nesting a second
// unit of work. `mintApiToken` adds the boundary for direct bus dispatch.
export const mintApiTokenCore = (
  input: MintApiTokenInput,
): Effect.Effect<MintApiTokenResult, PersistenceUnavailable, ApiTokenRepository> =>
  Effect.gen(function* () {
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

// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const mintApiToken = (cmd: MintApiTokenCommand): MintApiTokenOutput =>
  mintApiTokenCore(cmd).pipe(withUnitOfWork);
