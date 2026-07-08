import { describe, it } from "@effect/vitest";
import { ok, strictEqual } from "assert";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/common/env-vars.js";
import { InvitationMailer } from "@/modules/organization/domain/ports/clients/invitation-mailer.client.js";
import { InvitationMailerLive } from "@/modules/organization/infrastructure/clients/invitation-mailer.client-live.js";
import { MailDeliveryError } from "@/platform/notifications/mail-errors.js";
import { Mailer } from "@/platform/notifications/mailer.js";
import { MailerFake, SentMails } from "@/test-utils/mailer-fake.js";

const APP_URL = "https://app.example.com";

// EnvVars only needs a config source here, not real env. A fixed map
// provider satisfies the required keys (and pins APP_URL so the accept
// URL is deterministic).
const EnvVarsTest = EnvVars.layer.pipe(
  Layer.provide(
    Layer.setConfigProvider(
      ConfigProvider.fromMap(
        new Map([
          ["APP_URL", APP_URL],
          ["DATABASE_URL", "postgres://test"],
          ["ZITADEL_ISSUER", "https://zitadel.test"],
          ["ZITADEL_CLIENT_ID", "client"],
          ["ZITADEL_CLIENT_SECRET", "secret"],
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
      if (mail === undefined) throw new Error("expected one rendered mail");
      strictEqual(mail.to, "alice@example.com");
      ok(mail.subject.length > 0);
      // The link must survive into BOTH the HTML and the plaintext body —
      // building it correctly is the adapter's whole job.
      ok(mail.html.includes(expectedUrl), "html should contain the accept URL");
      ok(mail.text.includes(expectedUrl), "text should contain the accept URL");
    }).pipe(
      Effect.provide(InvitationMailerLive.pipe(Layer.provideMerge(MailerFake))),
      Effect.provide(EnvVarsTest),
    ),
  );

  it.effect("swallows a transport failure so a flaky relay can't fail the invite", () =>
    Effect.gen(function* () {
      const mailer = yield* InvitationMailer;
      const now = yield* DateTime.now;

      // Port surface is `Effect<void>` — a MailDeliveryError from the
      // transport is logged and absorbed, not propagated.
      yield* mailer.send({
        to: "bob@example.com",
        token,
        expiresAt: DateTime.add(now, { days: 7 }),
      });
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
        ),
      ),
      Effect.provide(EnvVarsTest),
    ),
  );
});
