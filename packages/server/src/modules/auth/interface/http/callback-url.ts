// Reconstructs the absolute callback URL openid-client needs for token
// exchange. The trap this fixes: Next's `/api/*` rewrite (ADR-0018) strips
// the `/api` prefix before the request reaches this server, so the inbound
// `httpReq.url` is `/auth/callback?...` rather than `/api/auth/callback?...`.
// Zitadel rejects the token exchange if `redirect_uri` doesn't match the
// authorize-time value byte-for-byte — so we reuse the env-configured URI
// for origin+path and only carry the query string from the inbound request.

export const buildCallbackUrl = (envRedirectUri: string, requestUrl: string): URL => {
  const queryIndex = requestUrl.indexOf("?");
  const query = queryIndex >= 0 ? requestUrl.slice(queryIndex) : "";
  return new URL(envRedirectUri + query);
};
