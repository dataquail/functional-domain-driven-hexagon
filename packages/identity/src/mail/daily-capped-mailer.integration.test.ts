import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import pg from "pg";
import { afterAll, beforeEach } from "vitest";

import { identityTestDatabaseUrl } from "../test-utils/identity-test-database.js";
import { dailyCappedMailer } from "./daily-capped-mailer.js";
import { type IdentityEmail, MailDeliveryError } from "./identity-mailer.js";

const database = new pg.Pool({ connectionString: identityTestDatabaseUrl(), max: 1 });

const email = (to: string): IdentityEmail => ({
  to,
  subject: "Hi",
  text: "plain",
  html: "<p>html</p>",
});

const sendAll = (dailyCap: number, recipients: ReadonlyArray<string>, sent: Array<string>) => {
  const mailer = dailyCappedMailer(
    { send: (mail) => Effect.sync(() => void sent.push(mail.to)) },
    database,
    dailyCap,
  );
  return Effect.forEach(recipients, (to) => Effect.exit(mailer.send(email(to))));
};

describe("dailyCappedMailer (integration)", () => {
  beforeEach(() => database.query("TRUNCATE mail_daily_counts"));
  afterAll(() => database.end());

  it.effect("sends until the day's cap and refuses every send after it", () =>
    Effect.gen(function* () {
      const sent: Array<string> = [];

      const exits = yield* sendAll(2, ["a@example.com", "b@example.com", "c@example.com"], sent);

      expect(sent).toEqual(["a@example.com", "b@example.com"]);
      expect(exits[2]).toEqual(
        Exit.fail(new MailDeliveryError({ message: "The daily cap of 2 emails is reached" })),
      );
    }),
  );

  it.effect("keeps counting across mailers built on the same day, as each request builds one", () =>
    Effect.gen(function* () {
      const sent: Array<string> = [];

      yield* sendAll(2, ["a@example.com"], sent);
      yield* sendAll(2, ["b@example.com", "c@example.com"], sent);

      expect(sent).toEqual(["a@example.com", "b@example.com"]);
    }),
  );

  it.effect("sends nothing when the cap is zero", () =>
    Effect.gen(function* () {
      const sent: Array<string> = [];

      const exits = yield* sendAll(0, ["a@example.com"], sent);

      expect(sent).toEqual([]);
      expect(exits.map(Exit.isSuccess)).toEqual([false]);
    }),
  );

  it.effect("fails a send it cannot count rather than sending it uncounted", () =>
    Effect.gen(function* () {
      const sent: Array<string> = [];
      const mailer = dailyCappedMailer(
        { send: (mail) => Effect.sync(() => void sent.push(mail.to)) },
        { query: () => Promise.reject(new Error("connection refused")) },
        5,
      );

      const exit = yield* Effect.exit(mailer.send(email("a@example.com")));

      expect(sent).toEqual([]);
      expect(exit).toEqual(
        Exit.fail(
          new MailDeliveryError({
            message: "Could not count today's sends: Error: connection refused",
          }),
        ),
      );
    }),
  );
});
