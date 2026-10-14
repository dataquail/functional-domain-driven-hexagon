import { deepStrictEqual, ok, strictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.ts";
import { MailDeliveryError } from "@/globals/infrastructure/email/ports/mail-errors.ts";
import { Mailer } from "@/globals/infrastructure/email/ports/mailer.ts";
import { InvitationEmailUndelivered } from "@/modules/organization/domain/invitation/invitation.errors.ts";
import { InvitationMailer } from "@/modules/organization/domain/ports/clients/invitation-mailer.client.ts";
import { InvitationMailerLive } from "@/modules/organization/infrastructure/clients/invitation-mailer.client-live.ts";
import { MailerFake, SentMails } from "@/test-utils/mailer-fake.ts";

const APP_URL = "https://app.example.com";

// EnvVars only needs a config source here, not real env. A fixed map
// provider satisfies the required keys (and pins APP_URL so the accept
// URL is deterministic).
const EnvVarsTest = EnvVars.layer.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown(
        Object.fromEntries([
          ["APP_URL", APP_URL],
          ["DATABASE_URL", "postgres://test"],
          ["IDENTITY_ISSUER", "https://identity.test"],
          ["IDENTITY_CLIENT_ID", "client"],
          ["IDENTITY_CLIENT_SECRET", "secret"],
          ["SESSION_COOKIE_SECRET", "session-secret"],
          ["STRIPE_SECRET_KEY", "sk_test"],
          ["STRIPE_WEBHOOK_SECRET", "whsec_test"],
          ["STRIPE_PRICE_ID_DEFAULT", "price_test"],
        ]),
      ),
    ),
  ),
);

const token = "tok_abc-123_XYZ";
const expectedUrl = `${APP_URL}/invitations/${token}`;

describe("InvitationMailerLive", () => {
  it.effect("renders the template and forwards the accept link to the transport", () =>
    Effect.gen(function* () {
      const mailer = yield* InvitationMailer;
      const sent = yield* SentMails;
      const now = yield* DateTime.now;

      yield* mailer.send({
        to: "alice@example.com",
        token,
        expiresAt: DateTime.add(now, { days: 7 }),
      });

      const mails = yield* sent.all;
      strictEqual(mails.length, 1);
      const mail = mails[0];

      assertDefined(mail);
      strictEqual(mail.to, "alice@example.com");
      ok(mail.subject.length > 0);
      // The link must survive into BOTH the HTML and the plaintext body —
      // building it correctly is the adapter's whole job.
      ok(mail.html.includes(expectedUrl), "html should contain the accept URL");
      ok(mail.text.includes(expectedUrl), "text should contain the accept URL");
    }).pipe(
      Effect.provide(
        InvitationMailerLive.pipe(Layer.provideMerge(MailerFake), Layer.provide(EnvVarsTest)),
      ),
    ),
  );

  it.effect("surfaces a transport failure so the delivery is retried", () =>
    Effect.gen(function* () {
      const mailer = yield* InvitationMailer;
      const now = yield* DateTime.now;

      const exit = yield* mailer
        .send({ to: "bob@example.com", token, expiresAt: DateTime.add(now, { days: 7 }) })
        .pipe(Effect.exit);

      deepStrictEqual(exit, Exit.fail(new InvitationEmailUndelivered({ message: "relay down" })));
    }).pipe(
      Effect.provide(
        InvitationMailerLive.pipe(
          Layer.provide(
            Layer.succeed(
              Mailer,
              Mailer.of({
                send: () => Effect.fail(new MailDeliveryError({ message: "relay down" })),
              }),
            ),
          ),
          Layer.provide(EnvVarsTest),
        ),
      ),
    ),
  );
});
