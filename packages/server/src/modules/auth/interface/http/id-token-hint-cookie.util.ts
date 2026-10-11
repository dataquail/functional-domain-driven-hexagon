export const ID_TOKEN_HINT_COOKIE_NAME = "oidc_id_token_hint";

export const readIdTokenHint = (
  cookies: Readonly<Record<string, string | undefined>>,
): string | null => {
  const hint = cookies[ID_TOKEN_HINT_COOKIE_NAME];
  return hint === undefined || hint === "" ? null : hint;
};
