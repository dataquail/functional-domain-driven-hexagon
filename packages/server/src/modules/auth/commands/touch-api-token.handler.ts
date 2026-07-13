import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { type TouchApiTokenCommand } from "@/modules/auth/commands/touch-api-token.command.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops.js";
import { ApiTokenSpecifications } from "@/modules/auth/domain/api-token/api-token.specification.js";

// Last-used stamp, throttled + race-tolerant.
//
// Throttled: skip the write when the prior `lastUsedAt` is younger than
// `thresholdSeconds`, so a chatty CLI/MCP doesn't UPDATE on every call.
// Race/transient-tolerant: a token revoked or removed between the
// middleware's lookup and our update is benign (`update` fails NotFound),
// and a transient store outage shouldn't fail a request the bearer check
// already authorized — both are swallowed.
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const touchApiToken = Effect.fn("touchApiToken")(function* (cmd: TouchApiTokenCommand) {
  const repo = yield* ApiTokenRepository;
  const token = yield* repo
    .findOne(ApiTokenSpecifications.withId(cmd.apiTokenId))
    .pipe(Effect.catchTag("PersistenceUnavailable", () => Effect.succeed(null)));
  if (token?.revokedAt !== null) return;

  const now = yield* DateTime.now;
  const elapsed = DateTime.distance(token.lastUsedAt, now);
  if (Duration.isLessThan(elapsed, Duration.seconds(cmd.thresholdSeconds))) return;

  yield* repo.updateOne(ApiTokenRootOps.touch({ token, now })).pipe(
    Effect.catchTag("ApiTokenNotFound", () => Effect.void),
    Effect.catchTag("PersistenceUnavailable", () => Effect.void),
  );
});
