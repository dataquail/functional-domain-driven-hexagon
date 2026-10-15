import * as Option from "effect/Option";

export const ID_TOKEN_HINT_COOKIE_NAME = "oidc_id_token_hint";

export const readCookie = (
  cookies: Readonly<Partial<Record<string, string>>>,
  name: string,
): Option.Option<string> =>
  Option.filter(Option.fromUndefinedOr(cookies[name]), (value) => value !== "");

export const readIdTokenHint = (
  cookies: Readonly<Partial<Record<string, string>>>,
): Option.Option<string> => readCookie(cookies, ID_TOKEN_HINT_COOKIE_NAME);
