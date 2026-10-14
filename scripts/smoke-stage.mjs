#!/usr/bin/env node
// Asks a deployed stage the three questions that say it is up: the identity
// Worker publishes its OIDC discovery document under the issuer the server
// expects, the app's /api proxy reaches the server Worker (which refuses an
// anonymous caller), and the SvelteKit Worker renders without a server error.
// Reads APP_URL and IDENTITY_ISSUER, which scripts/stage-env.mjs exports.

const required = (name) => {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`${name} is not set`);
  return value;
};

const appUrl = required("APP_URL");
const issuer = required("IDENTITY_ISSUER");

const checks = [
  {
    name: "identity discovery",
    url: `${issuer}/.well-known/openid-configuration`,
    accept: async (response) =>
      response.status === 200 && (await response.json()).issuer === issuer,
  },
  {
    name: "app → server proxy",
    url: `${appUrl}/api/auth/me`,
    accept: async (response) => response.status === 401,
  },
  {
    name: "app render",
    url: `${appUrl}/`,
    accept: async (response) => response.status < 500,
  },
];

let failed = false;
for (const check of checks) {
  const response = await fetch(check.url, { redirect: "manual" }).catch((cause) => cause);
  const ok = response instanceof Response && (await check.accept(response));
  const outcome = response instanceof Response ? response.status : String(response);
  console.log(`${ok ? "✓" : "✗"} ${check.name}: ${check.url} → ${outcome}`);
  failed ||= !ok;
}
process.exit(failed ? 1 : 0);
