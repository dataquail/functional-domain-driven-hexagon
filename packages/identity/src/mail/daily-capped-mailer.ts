import * as Effect from "effect/Effect";

import { type IdentityMailer, MailDeliveryError } from "./identity-mailer.js";

export type SendCountStore = {
  readonly query: (
    text: string,
    params?: ReadonlyArray<unknown>,
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
export const dailyCappedMailer = (
  transport: IdentityMailer,
  store: SendCountStore,
  dailyCap: number,
): IdentityMailer => {
  const claimTodaysSend = Effect.tryPromise({
    try: () => store.query(CLAIM_TODAYS_SEND, [dailyCap]),
    catch: (cause) =>
      new MailDeliveryError({ message: `Could not count today's sends: ${String(cause)}` }),
  }).pipe(Effect.map(({ rows }) => rows.length === 1));
  return {
    send: (email) =>
      claimTodaysSend.pipe(
        Effect.flatMap((claimed) =>
          claimed
            ? transport.send(email)
            : Effect.fail(
                new MailDeliveryError({
                  message: `The daily cap of ${dailyCap} emails is reached`,
                }),
              ),
        ),
      ),
  };
};
