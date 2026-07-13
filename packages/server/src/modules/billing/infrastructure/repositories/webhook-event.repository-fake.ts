import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.js";
import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

export const WebhookEventRepositoryFake = Layer.effect(
  WebhookEventRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<string, WebhookEventRecord>());

    const insertOne = (stripeEventId: string): Effect.Effect<void, WebhookEventAlreadyRecorded> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, stripeEventId)
          ? Effect.fail(new WebhookEventAlreadyRecorded({ stripeEventId }))
          : Effect.flatMap(DateTime.now, (now) =>
              Ref.update(store, HashMap.set(stripeEventId, { stripeEventId, receivedAt: now })),
            ),
      );

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (
      spec: Specification<WebhookEventRecord>,
    ): Effect.Effect<WebhookEventRecord | null> =>
      Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

    return WebhookEventRepository.of({ insertOne, findOne });
  }),
);
