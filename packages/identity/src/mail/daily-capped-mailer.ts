import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type IdentityMailer, MailDeliveryError } from "./identity-mailer.ts";

export class SendCountUnavailable extends Schema.TaggedError<
  SendCountUnavailable,
  { readonly brand: "SendCountUnavailable" }
>()("SendCountUnavailable", { reason: Schema.String }) {}

// Claims one of today's sends, answering whether there was one left under the cap.
export type SendCountStore = {
  readonly claimTodaysSend: (dailyCap: number) => Effect.Effect<boolean, SendCountUnavailable>;
};

export type CountingDatabase = {
  readonly query: (
    text: string,
    params: ReadonlyArray<number>,
  ) => Promise<{ readonly rows: ReadonlyArray<unknown> }>;
};

export const MAIL_DAILY_COUNTS_TABLE = `
  CREATE TABLE IF NOT EXISTS mail_daily_counts (
    day date PRIMARY KEY,
    sent integer NOT NULL CHECK (sent >= 0)
  )
`;

const CLAIM_TODAYS_SEND = `
  INSERT INTO mail_daily_counts (day, sent)
  SELECT current_date, 1 WHERE $1::integer > 0
  ON CONFLICT (day) DO UPDATE SET sent = mail_daily_counts.sent + 1
  WHERE mail_daily_counts.sent < $1::integer
  RETURNING sent
`;

// Counts each send against today's row and refuses once the cap is reached;
// a send the transport then refuses still counts, which errs toward sending less.
export const sendCountStoreIn = (database: CountingDatabase): SendCountStore => ({
  claimTodaysSend: (dailyCap) =>
    Effect.tryPromise({
      try: () => database.query(CLAIM_TODAYS_SEND, [dailyCap]),
      catch: (cause) => new SendCountUnavailable({ reason: String(cause) }),
    }).pipe(Effect.map(({ rows }) => rows.length === 1)),
});

export const dailyCappedMailer = (
  transport: IdentityMailer,
  store: SendCountStore,
  dailyCap: number,
): IdentityMailer => {
  const claimTodaysSend = store
    .claimTodaysSend(dailyCap)
    .pipe(
      Effect.mapError(
        ({ reason }) =>
          new MailDeliveryError({ message: `Could not count today's sends: ${reason}` }),
      ),
    );

  const capReached = () =>
    new MailDeliveryError({ message: `The daily cap of ${dailyCap} emails is reached` });

  return {
    send: (email) =>
      claimTodaysSend.pipe(
        Effect.filterOrFail((claimed) => claimed, capReached),
        Effect.andThen(transport.send(email)),
      ),
  };
};
