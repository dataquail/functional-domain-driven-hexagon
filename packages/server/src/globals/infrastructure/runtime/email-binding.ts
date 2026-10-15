import type * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Option from "effect/Option";

export type EmailBindingMessage = {
  readonly from: { readonly email: string; readonly name: string };
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

export type EmailBindingService = {
  readonly send: Option.Option<
    (message: EmailBindingMessage) => Effect.Effect<void, Cause.UnknownError>
  >;
};

// The Cloudflare `send_email` binding, present only inside a deployed Worker.
export const EmailBinding = Context.Reference<EmailBindingService>("EmailBinding", {
  defaultValue: () => ({ send: Option.none() }),
});
