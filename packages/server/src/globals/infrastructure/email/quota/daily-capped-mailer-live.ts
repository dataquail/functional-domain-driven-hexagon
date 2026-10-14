import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { MailDeliveryError } from "../ports/mail-errors.js";
import { Mailer, type MailerShape } from "../ports/mailer.js";

// Counts each send against today's row and refuses once the cap is reached;
// a send the transport then refuses still counts, which errs toward sending less.
const dailyCappedMailer = Effect.fn("dailyCappedMailer")(function* (
  transport: MailerShape,
  dailyCap: number,
) {
  const sql = yield* Database.Database;
  const claimTodaysSend = sql`
    INSERT INTO platform.mail_daily_counts (day, sent)
    SELECT current_date, 1 WHERE ${dailyCap}::integer > 0
    ON CONFLICT (day) DO UPDATE SET sent = platform.mail_daily_counts.sent + 1
    WHERE platform.mail_daily_counts.sent < ${dailyCap}::integer
    RETURNING sent
  `.pipe(
    Database.mapSqlError,
    Effect.map((claimed) => claimed.length === 1),
    Effect.mapError(
      (error) => new MailDeliveryError({ message: `Could not count today's sends: ${error._tag}` }),
    ),
  );
  return Mailer.of({
    send: (message) =>
      claimTodaysSend.pipe(
        Effect.flatMap((claimed) =>
          claimed
            ? transport.send(message)
            : Effect.fail(
                new MailDeliveryError({
                  message: `The daily cap of ${dailyCap} emails is reached`,
                }),
              ),
        ),
      ),
  });
});

export const withDailyCap = <E, R>(transport: Layer.Layer<Mailer, E, R>, dailyCap: number) =>
  Layer.effect(
    Mailer,
    Effect.gen(function* () {
      return yield* dailyCappedMailer(yield* Mailer, dailyCap);
    }),
  ).pipe(Layer.provide(transport));
