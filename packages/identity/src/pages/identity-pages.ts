import { html, SafeHtml } from "./html.js";

const STYLES = `
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; }
  main { width: min(24rem, 100% - 2rem); display: grid; gap: 1rem; }
  h1 { font-size: 1.5rem; margin: 0; }
  form { display: grid; gap: 0.75rem; }
  label { display: grid; gap: 0.25rem; font-size: 0.875rem; }
  input { font: inherit; padding: 0.5rem 0.75rem; border: 1px solid GrayText; border-radius: 0.375rem; }
  button { font: inherit; padding: 0.5rem 0.75rem; border: 0; border-radius: 0.375rem; background: LinkText; color: Canvas; cursor: pointer; }
  button.secondary { background: transparent; color: LinkText; border: 1px solid LinkText; }
  .error { color: #b91c1c; margin: 0; }
  .notice { margin: 0; }
  nav { display: flex; justify-content: space-between; font-size: 0.875rem; }
`;

const page = (title: string, body: SafeHtml): SafeHtml =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          ${new SafeHtml(STYLES)}
        </style>
      </head>
      <body>
        <main>
          <h1>${title}</h1>
          ${body}
        </main>
      </body>
    </html>`;

const errorLine = (error: string | undefined): SafeHtml | null =>
  error === undefined ? null : html`<p class="error" role="alert">${error}</p>`;

const withQuery = (path: string, query: string): string =>
  query === "" ? path : `${path}?${query}`;

export type SignInPageProps = {
  readonly oauthQuery: string;
  readonly email?: string;
  readonly error?: string;
};

export const signInPage = ({ email, error, oauthQuery }: SignInPageProps): SafeHtml =>
  page(
    "Sign in",
    html`${errorLine(error)}
      <form method="post" action="${withQuery("/sign-in", oauthQuery)}">
        <label
          >Email
          <input name="email" type="email" autocomplete="username" required value="${email ?? ""}"
        /></label>
        <label
          >Password <input name="password" type="password" autocomplete="current-password" required
        /></label>
        <button type="submit">Sign in</button>
      </form>
      <nav>
        <a href="${withQuery("/sign-up", oauthQuery)}">Create an account</a>
        <a href="/forgot-password">Forgot password?</a>
      </nav>`,
  );

export type SignUpPageProps = {
  readonly oauthQuery: string;
  readonly name?: string;
  readonly email?: string;
  readonly error?: string;
};

export const signUpPage = ({ email, error, name, oauthQuery }: SignUpPageProps): SafeHtml =>
  page(
    "Create an account",
    html`${errorLine(error)}
      <form method="post" action="${withQuery("/sign-up", oauthQuery)}">
        <label>Name <input name="name" autocomplete="name" required value="${name ?? ""}" /></label>
        <label
          >Email
          <input name="email" type="email" autocomplete="email" required value="${email ?? ""}"
        /></label>
        <label
          >Password
          <input name="password" type="password" autocomplete="new-password" minlength="8" required
        /></label>
        <button type="submit">Create account</button>
      </form>
      <nav>
        <a href="${withQuery("/sign-in", oauthQuery)}">Already have an account? Sign in</a>
      </nav>`,
  );

export const checkEmailPage = (email: string): SafeHtml =>
  page(
    "Check your email",
    html`<p class="notice">
      We sent a verification link to <strong>${email}</strong>. Follow it to finish creating your
      account.
    </p>`,
  );

export type ForgotPasswordPageProps = { readonly error?: string };

export const forgotPasswordPage = ({ error }: ForgotPasswordPageProps): SafeHtml =>
  page(
    "Reset your password",
    html`${errorLine(error)}
      <form method="post" action="/forgot-password">
        <label>Email <input name="email" type="email" autocomplete="email" required /></label>
        <button type="submit">Send reset link</button>
      </form>`,
  );

export const resetLinkSentPage = (): SafeHtml =>
  page(
    "Check your email",
    html`<p class="notice">If an account exists for that address, a reset link is on its way.</p>`,
  );

export type ResetPasswordPageProps = { readonly token: string; readonly error?: string };

export const resetPasswordPage = ({ error, token }: ResetPasswordPageProps): SafeHtml =>
  page(
    "Choose a new password",
    html`${errorLine(error)}
      <form method="post" action="/reset-password">
        <input type="hidden" name="token" value="${token}" />
        <label
          >New password
          <input name="password" type="password" autocomplete="new-password" minlength="8" required
        /></label>
        <button type="submit">Set password</button>
      </form>`,
  );

export const passwordChangedPage = (appUrl: string): SafeHtml =>
  page(
    "Password changed",
    html`<p class="notice">Your password has been updated.</p>
      <a href="${appUrl}">Back to the app</a>`,
  );

export type ConsentPageProps = {
  readonly oauthQuery: string;
  readonly clientName: string;
  readonly scopes: ReadonlyArray<string>;
};

export const consentPage = ({ clientName, oauthQuery, scopes }: ConsentPageProps): SafeHtml =>
  page(
    "Allow access?",
    html`<p class="notice"><strong>${clientName}</strong> is asking to:</p>
      <ul>
        ${scopes.map((scope) => html`<li>${scope}</li>`)}
      </ul>
      <form method="post" action="${withQuery("/consent", oauthQuery)}">
        <button type="submit" name="accept" value="true">Allow</button>
        <button class="secondary" type="submit" name="accept" value="false">Deny</button>
      </form>`,
  );

export const notFoundPage = (): SafeHtml =>
  page("Not found", html`<p class="notice">There is nothing here.</p>`);
