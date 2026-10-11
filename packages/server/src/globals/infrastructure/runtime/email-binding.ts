import * as Context from "effect/Context";

export type EmailBindingMessage = {
  readonly from: { readonly email: string; readonly name: string };
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

export type EmailBindingShape = {
  readonly send?: (message: EmailBindingMessage) => Promise<unknown>;
};

// The Cloudflare `send_email` binding, present only inside a deployed Worker.
export const EmailBinding = Context.Reference<EmailBindingShape>("EmailBinding", {
  defaultValue: () => ({}),
});
