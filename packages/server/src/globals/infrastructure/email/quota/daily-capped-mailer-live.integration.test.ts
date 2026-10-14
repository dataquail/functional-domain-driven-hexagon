import { deepStrictEqual } from "node:assert";

import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { MailDeliveryError } from "@/globals/infrastructure/email/ports/mail-errors.js";
import { Mailer, type MailMessage } from "@/globals/infrastructure/email/ports/mailer.js";
import { withDailyCap } from "@/globals/infrastructure/email/quota/daily-capped-mailer-live.js";
import { describeIntegration } from "@/test-utils/server-test-runtime.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

const message = (to: string): MailMessage => ({
  to,
  subject: "Hi",
  text: "plain",
  html: "<p>html</p>",
});

const recordingTransport = (sent: Array<string>) =>
  Layer.succeed(Mailer, Mailer.of({ send: (mail) => Effect.sync(() => void sent.push(mail.to)) }));

const sendAll = (dailyCap: number, recipients: ReadonlyArray<string>, sent: Array<string>) =>
  Effect.gen(function* () {
    const mailer = yield* Mailer;

    return yield* Effect.forEach(recipients, (to) => Effect.exit(mailer.send(message(to))));
  }).pipe(Effect.provide(withDailyCap(recordingTransport(sent), dailyCap)));

const SentRow = Schema.Struct({ sent: Schema.Int });

const todaysCount = Effect.gen(function* () {
  const sql = yield* Database.Database;

  const row = yield* sql`
    SELECT sent FROM platform.mail_daily_counts WHERE day = current_date
  `.pipe(Database.maybeRow(SentRow), Effect.orDie);

  return Option.match(row, { onNone: () => 0, onSome: ({ sent }) => sent });
});

describeIntegration(
  "withDailyCap",
  { layer: TestDatabaseLive, tables: ["platform.mail_daily_counts"] },
  (it) => {
    it.effect("sends until the day's cap and refuses every send after it", () =>
      Effect.gen(function* () {
        const sent: Array<string> = [];

        const exits = yield* sendAll(2, ["a@example.com", "b@example.com", "c@example.com"], sent);

        deepStrictEqual(sent, ["a@example.com", "b@example.com"]);
        deepStrictEqual(exits.map(Exit.isSuccess), [true, true, false]);
        deepStrictEqual(
          exits[2],
          Exit.fail(new MailDeliveryError({ message: "The daily cap of 2 emails is reached" })),
        );
        deepStrictEqual(yield* todaysCount, 2);
      }),
    );

    it.effect("keeps counting across mailers built on the same day", () =>
      Effect.gen(function* () {
        const sent: Array<string> = [];

        yield* sendAll(2, ["a@example.com"], sent);
        yield* sendAll(2, ["b@example.com", "c@example.com"], sent);

        deepStrictEqual(sent, ["a@example.com", "b@example.com"]);
      }),
    );

    it.effect("sends nothing when the cap is zero", () =>
      Effect.gen(function* () {
        const sent: Array<string> = [];

        const exits = yield* sendAll(0, ["a@example.com"], sent);

        deepStrictEqual(sent, []);
        deepStrictEqual(exits.map(Exit.isSuccess), [false]);
      }),
    );
  },
);
