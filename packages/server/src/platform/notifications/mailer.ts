import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

// Platform port for outbound email. Phase 3 introduces it for the
// invite-by-email flow with a `LogMailer` Live (structured logs only,
// no real SMTP). A real backend (SES/Postmark/etc.) plugs in by
// providing a different Live without touching command-handler code.
export type MailInput = {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
};

// `send` errors aren't modeled yet — `LogMailerLive` can't fail and
// the production-grade backend will introduce its own error type when
// it lands. Until then, mailing is fire-and-forget from the handler's
// perspective.
export type MailerShape = {
  readonly send: (input: MailInput) => Effect.Effect<void>;
};

export class Mailer extends Context.Tag("Mailer")<Mailer, MailerShape>() {}
