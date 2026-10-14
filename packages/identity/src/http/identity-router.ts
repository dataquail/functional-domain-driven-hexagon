import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as String from "effect/String";

import type { IdentityAuthPort } from "../auth/identity-auth-port.ts";
import { htmlResponse } from "../pages/html.ts";
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
} from "../pages/identity-pages.ts";
import { SeedRequest } from "../seed/identity-seed.ts";

export type IdentityRouterContext = {
  readonly auth: IdentityAuthPort;
  readonly appUrl: string;
  readonly seedToken: Option.Option<string>;
};

const AUTH_BASE_PATH = "/api/auth";

const RedirectBody = Schema.Union([
  Schema.Struct({ url: Schema.String }),
  Schema.Struct({ redirect_uri: Schema.String }),
]);

const ErrorBody = Schema.Struct({ message: Schema.String, code: Schema.optional(Schema.String) });

type ErrorBody = typeof ErrorBody.Type;

// A body that is not JSON, or not the expected JSON, is simply absent.
const readJsonAs = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) => {
  const decode = Schema.decodeUnknownOption(schema);

  return (message: Request | Response): Effect.Effect<Option.Option<S["Type"]>> =>
    Effect.tryPromise(() => message.clone().json()).pipe(
      Effect.map((json) => decode(json)),
      Effect.orElseSucceed(() => Option.none()),
    );
};

const readRedirectBody = readJsonAs(RedirectBody);

const readErrorBody = readJsonAs(ErrorBody);

const readSeedRequest = readJsonAs(SeedRequest);

const readForm = (request: Request): Effect.Effect<FormData> =>
  Effect.tryPromise(() => request.clone().formData()).pipe(
    Effect.orElseSucceed(() => new FormData()),
  );

const redirectTo = (location: string, from?: Response): Response => {
  const headers = new Headers({ location });

  for (const cookie of from?.headers.getSetCookie() ?? []) headers.append("set-cookie", cookie);

  return new Response("", { status: 302, headers });
};

const redirectLocation = (body: typeof RedirectBody.Type): string => {
  if ("url" in body) return body.url;

  return body.redirect_uri;
};

// Better Auth answers a navigation with a redirect and a fetch with `{ url }`; a form post can be either.
const followAuthRedirect = Effect.fn("followAuthRedirect")(function* (response: Response) {
  if (response.status >= 300 && response.status < 400) return Option.some(response);

  if (!response.ok) return Option.none();
  const body = yield* readRedirectBody(response);

  return Option.map(body, (redirect) => redirectTo(redirectLocation(redirect), response));
});

const authErrorMessage = (error: Option.Option<ErrorBody>, fallback: string): string =>
  Option.getOrElse(
    Option.map(error, ({ message }) => message),
    () => fallback,
  );

const signInErrorMessage = (error: Option.Option<ErrorBody>): string => {
  if (Option.exists(error, ({ code }) => code === "EMAIL_NOT_VERIFIED")) {
    return "Verify your email address first. We sent you a new link.";
  }

  return "Invalid email or password.";
};

const decodeFormField = Schema.decodeUnknownOption(Schema.String);

// A file upload or a missing field reads as an empty field.
const formField = (form: FormData, name: string): string =>
  Option.getOrElse(decodeFormField(form.get(name)), () => "");

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

  if (Option.isSome(redirect)) return redirect.value;

  if (response.ok) return redirectTo(context.appUrl, response);

  const error = signInErrorMessage(yield* readErrorBody(response));

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

  const error = authErrorMessage(
    yield* readErrorBody(response),
    "We could not create that account.",
  );

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

  const error = authErrorMessage(
    yield* readErrorBody(response),
    "That reset link is no longer valid.",
  );

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

  return Option.getOrElse(yield* followAuthRedirect(response), () =>
    htmlResponse(notFoundPage(), response.status),
  );
});

const BEARER = "Bearer ";

const bearerToken = (request: Request): Option.Option<string> => {
  const header = request.headers.get("authorization") ?? "";

  if (!header.startsWith(BEARER)) return Option.none();

  return Option.some(header.slice(BEARER.length));
};

const seed = Effect.fn("identity.seed")(function* (
  request: Request,
  context: IdentityRouterContext,
) {
  const seedToken = Option.filter(context.seedToken, String.isNonEmpty);

  if (Option.isNone(seedToken)) return htmlResponse(notFoundPage(), 404);

  if (!Option.contains(bearerToken(request), seedToken.value)) {
    return new Response("", { status: 401 });
  }

  const decoded = yield* readSeedRequest(request);

  if (Option.isNone(decoded)) {
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
