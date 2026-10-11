import { html } from "../pages/html.js";
import type { IdentityEmail } from "./identity-mailer.js";

export type EmailLink = { readonly to: string; readonly url: string };

export const verificationEmail = ({ to, url }: EmailLink): IdentityEmail => ({
  to,
  subject: "Verify your email address",
  text: `Confirm your email address to finish creating your account:\n\n${url}\n`,
  html: html`<p>Confirm your email address to finish creating your account:</p>
    <p><a href="${url}">Verify email</a></p>`.value,
});

export const passwordResetEmail = ({ to, url }: EmailLink): IdentityEmail => ({
  to,
  subject: "Reset your password",
  text: `Someone asked to reset the password for this account. If it was you, follow this link:\n\n${url}\n\nOtherwise, ignore this email.`,
  html: html`<p>Someone asked to reset the password for this account. If it was you:</p>
    <p><a href="${url}">Reset password</a></p>
    <p>Otherwise, ignore this email.</p>`.value,
});
