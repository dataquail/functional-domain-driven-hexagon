// One-shot bootstrap script run by the `seed-zitadel` compose service.
//
// Responsibilities:
//   1. Create (idempotent) the project + OIDC application in Zitadel.
//   2. Pre-seed the bootstrap admin in the app DB so they have role=admin
//      before their first login. Roles live app-side, so JIT on first login
//      would otherwise create the admin with the default role and nobody
//      would be able to grant the admin role to anyone. See plan §3.6.
//
// Run via `pnpm auth:seed`. Requires a one-time manual PAT bootstrap; see
// the error message printed when ZITADEL_BOOTSTRAP_PAT is unset.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const issuer = process.env.ZITADEL_ISSUER ?? "http://localhost:8080";
// Zitadel keys instances by domain. The default instance is registered for
// `localhost` (= ExternalDomain in zitadel.yaml). Calls from the seed
// container connect to `zitadel:8080` over Docker DNS, but Zitadel must
// see Host=localhost:8080 to find the instance. Override here.
const instanceHost = process.env.ZITADEL_INSTANCE_HOST ?? "localhost:8080";
const adminEmail = process.env.ZITADEL_ADMIN_EMAIL ?? "admin@example.com";
// `APP_REDIRECT_URI` may be a single URL or a comma-separated list. During
// the Next.js migration both `http://localhost:5173/auth/callback` (the
// existing Vite SPA) and `http://localhost:3000/api/auth/callback` (Next
// proxied to the BFF, ADR-0018) need to be registered with Zitadel so
// users can sign in via either origin. Phase 6 cutover collapses this to
// a single `:3000` URI once the SPA is gone.
const redirectUris = (process.env.APP_REDIRECT_URI ?? "http://localhost:3001/auth/callback")
  .split(",")
  .map((u) => u.trim())
  .filter((u) => u.length > 0);
// Default must match `ZITADEL_POST_LOGOUT_REDIRECT_URI` in the server's
// env-vars.ts. If they drift apart, the server's logout request to
// `end_session_endpoint` is rejected with "post_logout_redirect_uri invalid".
const postLogoutRedirectUris = (
  process.env.APP_POST_LOGOUT_REDIRECT_URI ?? "http://localhost:5173/auth/login"
)
  .split(",")
  .map((u) => u.trim())
  .filter((u) => u.length > 0);
const dbUrl = process.env.APP_DATABASE_URL;
// Zitadel writes the bootstrap-bot PAT here on first boot (see
// FirstInstance.PatPath in zitadel.yaml). Mounted into this container by
// docker-compose.yml as a fallback for `ZITADEL_BOOTSTRAP_PAT`.
const patPath = process.env.ZITADEL_BOOTSTRAP_PAT_PATH ?? "/machinekey/zitadel-bootstrap.pat";

// SMTP — Zitadel notification provider config. Description is the
// idempotency key: ensureSmtpProvider searches for an existing provider with
// this description before deciding to create vs. update. Keep it stable
// across environments.
const SMTP_DESCRIPTION = process.env.SMTP_DESCRIPTION ?? "default";
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpFromAddress = process.env.SMTP_FROM_ADDRESS;
const smtpFromName = process.env.SMTP_FROM_NAME;

const pat = process.env.ZITADEL_BOOTSTRAP_PAT || readPatFromFile(patPath);

function readPatFromFile(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return undefined;
  }
}

if (!pat) {
  console.error(`
ZITADEL_BOOTSTRAP_PAT is not set and no PAT was found at ${patPath}.

Normal local flow: a fresh \`pnpm auth:up\` boots Zitadel with FirstInstance,
which writes the bootstrap PAT to ./infra/zitadel/.machinekey/. If the file
isn't there, your Zitadel volume was created before the declarative
machine-user config was added — the easiest fix is to wipe the Zitadel
volume and re-bootstrap:

  docker compose down
  docker volume rm $(basename $PWD)_zitadel_db_data
  pnpm auth:up && pnpm auth:seed

If you'd rather create the service user by hand:

  1. Open http://localhost:8080/ui/console
  2. Sign in as ${adminEmail} (default password: ChangeMe!1)
  3. Default Organization → Service Users → New
       Username: bootstrap-bot
       Name:     Bootstrap Bot
       Access Token Type: Bearer
  4. Open the new service user → Personal Access Tokens → New
     Copy the token.
  5. Default Organization → Members → Add Member
     Add bootstrap-bot with role: ORG_OWNER
  6. Save the token to your repo .env as ZITADEL_BOOTSTRAP_PAT=<token>
     and re-run 'pnpm auth:seed'.
`);
  process.exit(2);
}

if (!dbUrl) {
  console.error("APP_DATABASE_URL is not set.");
  process.exit(2);
}

const missingSmtp = [
  ["SMTP_HOST", smtpHost],
  ["SMTP_PORT", smtpPort],
  ["SMTP_FROM_ADDRESS", smtpFromAddress],
  ["SMTP_FROM_NAME", smtpFromName],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingSmtp.length > 0) {
  console.error(`
The following SMTP env vars are required but unset: ${missingSmtp.join(", ")}.

Local dev: defaults are wired in docker-compose.yml — if you're seeing this
running 'pnpm auth:seed' on a fresh clone, check that compose passed the
env through (look for the SMTP_* block under the seed-zitadel service).

For other environments, see .env.example for the full list and documentation.
`);
  process.exit(2);
}

async function waitForZitadel() {
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${issuer}/debug/ready`, {
        headers: { host: instanceHost },
      });
      if (r.ok) return;
      lastError = `${r.status} ${r.statusText}`;
    } catch (err) {
      lastError = err?.cause?.code ?? err?.message ?? String(err);
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(
    `Zitadel did not become ready at ${issuer}/debug/ready within 120s (last: ${lastError})`,
  );
}

async function api(path, init = {}) {
  const { tolerate, ...fetchInit } = init;
  const r = await fetch(`${issuer}${path}`, {
    ...fetchInit,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${pat}`,
      host: instanceHost,
      ...(fetchInit.headers ?? {}),
    },
  });
  if (!r.ok) {
    const text = await r.text();
    if (
      tolerate !== undefined &&
      r.status === tolerate.status &&
      text.includes(tolerate.messageIncludes)
    ) {
      return null;
    }
    throw new Error(`${init.method ?? "GET"} ${path} -> ${r.status} ${r.statusText}\n${text}`);
  }
  return r.json();
}

const PROJECT_NAME = "effect-monorepo";
const APP_NAME = "effect-monorepo-bff";

async function ensureProject() {
  const search = await api("/management/v1/projects/_search", {
    method: "POST",
    body: JSON.stringify({
      queries: [{ nameQuery: { name: PROJECT_NAME, method: "TEXT_QUERY_METHOD_EQUALS" } }],
    }),
  });
  if (search.result?.length) return search.result[0].id;
  const created = await api("/management/v1/projects", {
    method: "POST",
    body: JSON.stringify({ name: PROJECT_NAME }),
  });
  return created.id;
}

async function ensureOidcApp(projectId) {
  const search = await api(`/management/v1/projects/${projectId}/apps/_search`, {
    method: "POST",
    body: JSON.stringify({
      queries: [{ nameQuery: { name: APP_NAME, method: "TEXT_QUERY_METHOD_EQUALS" } }],
    }),
  });

  if (search.result?.length) {
    const app = search.result[0];
    // Update the OIDC config so re-running seed picks up env changes
    // (e.g. a moved redirect URI). Only the redirect-URI list is updated;
    // client_id / client_secret are stable across updates and aren't
    // re-emitted by Zitadel here.
    //
    // Zitadel returns 400 "No changes (COMMAND-1m88i)" when the PUT body
    // matches the stored config exactly. Treat that as success — re-running
    // an already-configured seed is the common case (e.g. `pnpm bootstrap`
    // run twice).
    await api(`/management/v1/projects/${projectId}/apps/${app.id}/oidc_config`, {
      method: "PUT",
      body: JSON.stringify({
        redirectUris,
        postLogoutRedirectUris,
        responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
        grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE", "OIDC_GRANT_TYPE_REFRESH_TOKEN"],
        appType: "OIDC_APP_TYPE_WEB",
        authMethodType: "OIDC_AUTH_METHOD_TYPE_BASIC",
        version: "OIDC_VERSION_1_0",
        devMode: true,
        accessTokenType: "OIDC_TOKEN_TYPE_JWT",
      }),
      tolerate: { status: 400, messageIncludes: "No changes" },
    });
    return {
      appId: app.id,
      clientId: app.oidcConfig?.clientId,
      clientSecret: null, // only returned at creation time
      updated: true,
    };
  }

  const created = await api(`/management/v1/projects/${projectId}/apps/oidc`, {
    method: "POST",
    body: JSON.stringify({
      name: APP_NAME,
      redirectUris,
      postLogoutRedirectUris,
      responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
      grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE", "OIDC_GRANT_TYPE_REFRESH_TOKEN"],
      appType: "OIDC_APP_TYPE_WEB",
      authMethodType: "OIDC_AUTH_METHOD_TYPE_BASIC",
      version: "OIDC_VERSION_1_0",
      devMode: true,
      accessTokenType: "OIDC_TOKEN_TYPE_JWT",
    }),
  });
  return {
    appId: created.appId,
    clientId: created.clientId,
    clientSecret: created.clientSecret,
    updated: false,
  };
}

async function findSmtpProvider() {
  const search = await api("/admin/v1/smtp/_search", {
    method: "POST",
    body: JSON.stringify({ queries: [] }),
  });
  return (search.result ?? []).find((p) => p.description === SMTP_DESCRIPTION);
}

async function ensureSmtpProvider() {
  const body = {
    description: SMTP_DESCRIPTION,
    senderAddress: smtpFromAddress,
    senderName: smtpFromName,
    replyToAddress: process.env.SMTP_REPLY_TO ?? "",
    tls: process.env.SMTP_TLS === "true",
    host: `${smtpHost}:${smtpPort}`,
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
  };

  const existing = await findSmtpProvider();
  if (existing) {
    await api(`/admin/v1/smtp/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
      // PUT with an unchanged body returns 400 "No changes" — re-running
      // seed against an already-configured provider is the common case.
      tolerate: { status: 400, messageIncludes: "No changes" },
    });
    return { id: existing.id, created: false };
  }
  const created = await api("/admin/v1/smtp", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: created.id, created: true };
}

async function activateSmtpProvider(id) {
  await api(`/admin/v1/smtp/${id}/_activate`, {
    method: "POST",
    body: "{}",
    // Activating the already-active provider returns a typed error.
    tolerate: { status: 400, messageIncludes: "AlreadyActive" },
  });
}

async function findAdminSubject() {
  const search = await api("/v2/users", {
    method: "POST",
    body: JSON.stringify({
      queries: [{ emailQuery: { emailAddress: adminEmail, method: "TEXT_QUERY_METHOD_EQUALS" } }],
    }),
  });
  const result = search.result ?? [];
  if (result.length === 0) {
    throw new Error(
      `No Zitadel user found with email ${adminEmail}. Did FirstInstance bootstrap run?`,
    );
  }
  return result[0].userId;
}

async function ensureAdminInAppDb(subject) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const tableCheck = await client.query(`SELECT to_regclass('public.auth_identities') AS exists`);
    if (tableCheck.rows[0].exists === null) {
      return { skipped: true };
    }

    await client.query("BEGIN");
    const existing = await client.query(`SELECT user_id FROM auth_identities WHERE subject = $1`, [
      subject,
    ]);
    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      return { userId: existing.rows[0].user_id, created: false };
    }

    const userId = randomUUID();
    await client.query(
      `INSERT INTO users (id, email, role, country, street, postal_code, created_at, updated_at)
       VALUES ($1, $2, 'admin', 'N/A', 'N/A', 'N/A', now(), now())
       ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
      [userId, adminEmail],
    );
    const userRow = await client.query(`SELECT id FROM users WHERE email = $1`, [adminEmail]);
    const finalUserId = userRow.rows[0].id;
    await client.query(
      `INSERT INTO auth_identities (subject, user_id, provider, created_at)
       VALUES ($1, $2, 'zitadel', now())`,
      [subject, finalUserId],
    );
    await client.query("COMMIT");
    return { userId: finalUserId, created: true };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* */
    }
    throw err;
  } finally {
    await client.end();
  }
}

(async () => {
  console.log(`Seeding Zitadel at ${issuer}`);

  console.log(`  waiting for Zitadel to be ready…`);
  await waitForZitadel();

  const projectId = await ensureProject();
  console.log(`  project: ${PROJECT_NAME} (${projectId})`);

  const { appId, clientId, clientSecret, updated } = await ensureOidcApp(projectId);
  console.log(`  app: ${APP_NAME} (${appId}) ${updated ? "[updated]" : "[created]"}`);

  // Verify what Zitadel actually has registered, not what we sent. Catches
  // silent PUT failures or shape mismatches.
  const verify = await api(`/management/v1/projects/${projectId}/apps/${appId}`);
  const registeredRedirects = verify.app?.oidcConfig?.redirectUris ?? [];
  const registeredPostLogout = verify.app?.oidcConfig?.postLogoutRedirectUris ?? [];
  console.log(`    redirectUris:           ${JSON.stringify(registeredRedirects)}`);
  console.log(`    postLogoutRedirectUris: ${JSON.stringify(registeredPostLogout)}`);
  for (const expected of redirectUris) {
    if (!registeredRedirects.includes(expected)) {
      console.warn(`    WARN: ${expected} not registered as a redirect URI`);
    }
  }
  for (const expected of postLogoutRedirectUris) {
    if (!registeredPostLogout.includes(expected)) {
      console.warn(`    WARN: ${expected} not registered as a post-logout URI`);
    }
  }

  const smtp = await ensureSmtpProvider();
  console.log(
    `  smtp: ${SMTP_DESCRIPTION} (${smtp.id}) ${smtp.created ? "[created]" : "[updated]"}`,
  );
  await activateSmtpProvider(smtp.id);
  console.log(`    active`);

  const subject = await findAdminSubject();
  console.log(`  admin sub: ${subject}`);

  const dbResult = await ensureAdminInAppDb(subject);
  if (dbResult.skipped) {
    console.log(
      `  app DB seed: SKIPPED — 'auth_identities' table not found.\n` +
        `              Run migrations (V3 ships in Phase 2), then re-run 'pnpm auth:seed'.`,
    );
  } else {
    console.log(
      `  app users.id: ${dbResult.userId} (${dbResult.created ? "created" : "already present"})`,
    );
  }

  console.log("");
  console.log("=== Add to .env (server) ===");
  console.log(`ZITADEL_CLIENT_ID=${clientId ?? "(see Zitadel console)"}`);
  if (clientSecret) {
    console.log(`ZITADEL_CLIENT_SECRET=${clientSecret}`);
    console.log("");
    console.log("Note: client_secret is only emitted at creation. Save it now.");
  } else {
    console.log("ZITADEL_CLIENT_SECRET=(unchanged — app already existed)");
  }

  // Machine-readable single line for CI to parse with `grep '^__seed__ '`.
  // Only emitted when both values are present (i.e. fresh app creation —
  // re-runs against an existing app can't recover the secret from Zitadel).
  if (clientId && clientSecret) {
    console.log(`__seed__ ZITADEL_CLIENT_ID=${clientId} ZITADEL_CLIENT_SECRET=${clientSecret}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
