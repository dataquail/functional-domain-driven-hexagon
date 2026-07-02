import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event-errors.js";

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

    const findOneByStripeEventId = (
      stripeEventId: string,
    ): Effect.Effect<Option.Option<WebhookEventRecord>> =>
      Effect.map(Ref.get(store), (m) => HashMap.get(m, stripeEventId));

    return WebhookEventRepository.of({ insertOne, findOneByStripeEventId });
  }),
);
