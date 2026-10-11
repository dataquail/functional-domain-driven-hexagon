import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type { IdentityAuthPort } from "../auth/identity-auth-port.js";
import { htmlResponse } from "../pages/html.js";
import {
  checkEmailPage,
  consentPage,
  forgotPasswordPage,
  notFoundPage,
  passwordChangedPage,
  resetLinkSentPage,
  resetPasswordPage,
  signInPage,
  signUpPage,
} from "../pages/identity-pages.js";
import { SeedRequest } from "../seed/identity-seed.js";

export type IdentityRouterContext = {
  readonly auth: IdentityAuthPort;
  readonly appUrl: string;
  readonly seedToken: string | undefined;
};

const AUTH_BASE_PATH = "/api/auth";

const RedirectBody = Schema.Union([
  Schema.Struct({ url: Schema.String }),
  Schema.Struct({ redirect_uri: Schema.String }),
]);
const decodeRedirectBody = Schema.decodeUnknownOption(RedirectBody);

const ErrorBody = Schema.Struct({ message: Schema.String, code: Schema.optional(Schema.String) });
const decodeErrorBody = Schema.decodeUnknownOption(ErrorBody);

const decodeSeedRequest = Schema.decodeUnknownOption(SeedRequest);

const readJson = (message: Request | Response): Effect.Effect<unknown> =>
  Effect.tryPromise(() => message.clone().json()).pipe(Effect.orElseSucceed(() => null));

const readForm = (request: Request): Effect.Effect<FormData> =>
  Effect.tryPromise(() => request.clone().formData()).pipe(
    Effect.orElseSucceed(() => new FormData()),
  );

const redirectTo = (location: string, from?: Response): Response => {
  const headers = new Headers({ location });
  for (const cookie of from?.headers.getSetCookie() ?? []) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
};

// Better Auth answers a navigation with a redirect and a fetch with `{ url }`; a form post can be either.
const followAuthRedirect = Effect.fn("followAuthRedirect")(function* (response: Response) {
  if (response.status >= 300 && response.status < 400) return response;
  if (!response.ok) return null;
  const body = decodeRedirectBody(yield* readJson(response));
  if (body._tag === "None") return null;
  return redirectTo("url" in body.value ? body.value.url : body.value.redirect_uri, response);
});

const authError = (response: Response) =>
  readJson(response).pipe(
    Effect.map((json) => {
      const body = decodeErrorBody(json);
      return body._tag === "Some" ? body.value : null;
    }),
  );

const formField = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const oauthQueryOf = (url: URL): string => url.search.replace(/^\?/, "");

const signIn = Effect.fn("identity.signIn")(function* (
  request: Request,
  url: URL,
  context: IdentityRouterContext,
) {
  const form = yield* readForm(request);
  const email = formField(form, "email");
  const oauthQuery = oauthQueryOf(url);
  const response = yield* context.auth.signIn({
    request,
    email,
    password: formField(form, "password"),
    oauthQuery,
  });
  const redirect = yield* followAuthRedirect(response);
  if (redirect !== null) return redirect;
  if (response.ok) return redirectTo(context.appUrl, response);
  const error =
    (yield* authError(response))?.code === "EMAIL_NOT_VERIFIED"
      ? "Verify your email address first. We sent you a new link."
      : "Invalid email or password.";
  return htmlResponse(signInPage({ oauthQuery, email, error }), response.status);
});

const signUp = Effect.fn("identity.signUp")(function* (
  request: Request,
  url: URL,
  context: IdentityRouterContext,
) {
  const form = yield* readForm(request);
  const name = formField(form, "name");
  const email = formField(form, "email");
  const response = yield* context.auth.signUp({
    request,
    name,
    email,
    password: formField(form, "password"),
    callbackUrl: context.appUrl,
  });
  if (response.ok) return htmlResponse(checkEmailPage(email));
  const error = (yield* authError(response))?.message ?? "We could not create that account.";
  return htmlResponse(
    signUpPage({ oauthQuery: oauthQueryOf(url), name, email, error }),
    response.status,
  );
});

const forgotPassword = Effect.fn("identity.forgotPassword")(function* (
  request: Request,
  url: URL,
  context: IdentityRouterContext,
) {
  const form = yield* readForm(request);
  yield* context.auth.requestPasswordReset({
    request,
    email: formField(form, "email"),
    redirectTo: new URL("/reset-password", url).toString(),
  });
  return htmlResponse(resetLinkSentPage());
});

const resetPassword = Effect.fn("identity.resetPassword")(function* (
  request: Request,
  context: IdentityRouterContext,
) {
  const form = yield* readForm(request);
  const token = formField(form, "token");
  const response = yield* context.auth.resetPassword({
    request,
    token,
    newPassword: formField(form, "password"),
  });
  if (response.ok) return htmlResponse(passwordChangedPage(context.appUrl));
  const error = (yield* authError(response))?.message ?? "That reset link is no longer valid.";
  return htmlResponse(resetPasswordPage({ token, error }), response.status);
});

const consent = Effect.fn("identity.consent")(function* (
  request: Request,
  url: URL,
  context: IdentityRouterContext,
) {
  const form = yield* readForm(request);
  const response = yield* context.auth.consent({
    request,
    accept: formField(form, "accept") === "true",
    oauthQuery: oauthQueryOf(url),
  });
  return (yield* followAuthRedirect(response)) ?? htmlResponse(notFoundPage(), response.status);
});

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
};

const seed = Effect.fn("identity.seed")(function* (
  request: Request,
  context: IdentityRouterContext,
) {
  if (context.seedToken === undefined || context.seedToken === "") {
    return htmlResponse(notFoundPage(), 404);
  }
  if (bearerToken(request) !== context.seedToken) return new Response(null, { status: 401 });
  const decoded = decodeSeedRequest(yield* readJson(request));
  if (decoded._tag === "None") {
    return Response.json({ error: "invalid seed request" }, { status: 400 });
  }
  return Response.json({ users: yield* context.auth.seed(decoded.value) });
});

const consentPageFor = (url: URL) =>
  consentPage({
    oauthQuery: oauthQueryOf(url),
    clientName: url.searchParams.get("client_id") ?? "An application",
    scopes: (url.searchParams.get("scope") ?? "").split(" ").filter((scope) => scope !== ""),
  });

export const handleIdentityRequest = (
  request: Request,
  context: IdentityRouterContext,
): Effect.Effect<Response> => {
  const url = new URL(request.url);
  if (url.pathname === AUTH_BASE_PATH || url.pathname.startsWith(`${AUTH_BASE_PATH}/`)) {
    return context.auth.handle(request);
  }
  switch (`${request.method} ${url.pathname}`) {
    case "GET /":
      return Effect.succeed(redirectTo(context.appUrl));
    case "GET /sign-in":
      return Effect.succeed(htmlResponse(signInPage({ oauthQuery: oauthQueryOf(url) })));
    case "POST /sign-in":
      return signIn(request, url, context);
    case "GET /sign-up":
      return Effect.succeed(htmlResponse(signUpPage({ oauthQuery: oauthQueryOf(url) })));
    case "POST /sign-up":
      return signUp(request, url, context);
    case "GET /forgot-password":
      return Effect.succeed(htmlResponse(forgotPasswordPage({})));
    case "POST /forgot-password":
      return forgotPassword(request, url, context);
    case "GET /reset-password":
      return Effect.succeed(
        htmlResponse(resetPasswordPage({ token: url.searchParams.get("token") ?? "" })),
      );
    case "POST /reset-password":
      return resetPassword(request, context);
    case "GET /consent":
      return Effect.succeed(htmlResponse(consentPageFor(url)));
    case "POST /consent":
      return consent(request, url, context);
    case "POST /internal/seed":
      return seed(request, context);
    default:
      return Effect.succeed(htmlResponse(notFoundPage(), 404));
  }
};
