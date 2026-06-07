import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";

export const WebhookEventRepositoryFake = Layer.effect(
  WebhookEventRepository,
  Effect.gen(function* () {
    const seen = yield* Ref.make(HashSet.empty<string>());

    const recordIfNew = (stripeEventId: string): Effect.Effect<boolean> =>
      Ref.modify(seen, (set) =>
        HashSet.has(set, stripeEventId) ? [false, set] : [true, HashSet.add(set, stripeEventId)],
      );

    return WebhookEventRepository.of({ recordIfNew });
  }),
);
