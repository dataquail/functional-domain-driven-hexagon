import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type Specification } from "@/globals/application/ddd/specification";
import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors";
import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/webhook-event/webhook-event.repository";

export const WebhookEventRepositoryFake = Layer.effect(
  WebhookEventRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<string, WebhookEventRecord>());

    const insertOne = (stripeEventId: string): Effect.Effect<void, WebhookEventAlreadyRecorded> =>
      Effect.gen(function* () {
        if (HashMap.has(yield* Ref.get(store), stripeEventId)) {
          return yield* new WebhookEventAlreadyRecorded({ stripeEventId });
        }

        const now = yield* DateTime.now;
        yield* Ref.update(store, HashMap.set(stripeEventId, { stripeEventId, receivedAt: now }));
      });

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (
      spec: Specification<WebhookEventRecord>,
    ): Effect.Effect<Option.Option<WebhookEventRecord>> =>
      Effect.map(Ref.get(store), (m) => Arr.findFirst(HashMap.values(m), spec));

    return WebhookEventRepository.of({ insertOne, findOne });
  }),
);
