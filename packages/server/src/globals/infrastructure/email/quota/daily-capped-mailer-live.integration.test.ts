import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { MailDeliveryError } from "@/globals/infrastructure/email/ports/mail-errors.js";
import { Mailer, type MailMessage } from "@/globals/infrastructure/email/ports/mailer.js";
import { withDailyCap } from "@/globals/infrastructure/email/quota/daily-capped-mailer-live.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

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

const todaysCount = Effect.gen(function* () {
  const sql = yield* Database.Database;
  const rows = yield* sql<{ sent: number }>`
    SELECT sent FROM platform.mail_daily_counts WHERE day = current_date
  `.pipe(Effect.orDie);
  return rows[0]?.sent ?? 0;
});

describe("withDailyCap", () => {
  const { run } = useServerTestRuntime(["platform.mail_daily_counts"]);

  it("sends until the day's cap and refuses every send after it", async () => {
    const sent: Array<string> = [];

    const exits = await run(sendAll(2, ["a@example.com", "b@example.com", "c@example.com"], sent));

    deepStrictEqual(sent, ["a@example.com", "b@example.com"]);
    deepStrictEqual(exits.map(Exit.isSuccess), [true, true, false]);
    deepStrictEqual(
      exits[2],
      Exit.fail(new MailDeliveryError({ message: "The daily cap of 2 emails is reached" })),
    );
    deepStrictEqual(await run(todaysCount), 2);
  });

  it("keeps counting across mailers built on the same day", async () => {
    const sent: Array<string> = [];

    await run(sendAll(2, ["a@example.com"], sent));
    await run(sendAll(2, ["b@example.com", "c@example.com"], sent));

    deepStrictEqual(sent, ["a@example.com", "b@example.com"]);
  });

  it("sends nothing when the cap is zero", async () => {
    const sent: Array<string> = [];

    const exits = await run(sendAll(0, ["a@example.com"], sent));

    deepStrictEqual(sent, []);
    deepStrictEqual(exits.map(Exit.isSuccess), [false]);
  });
});
