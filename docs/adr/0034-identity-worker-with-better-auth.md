# ADR-0034: The identity Worker — Better Auth as the OIDC issuer

- Status: Accepted
- Date: 2026-10-10
- Supersedes: ADR-0016. Amends: ADR-0017.

## Context and Problem Statement

ADR-0016 made a self-hosted Zitadel the identity provider and kept the server a pure OIDC relying party: Zitadel is consulted at sign-in and sign-out only, and every other request is authenticated by the app's own session cookie or a hashed PAT. The stack is moving to Cloudflare Workers (the Cloudflare serverless migration plan), and Zitadel is a long-running container with its own database, a bootstrap-PAT ritual and a management API the seed has to drive. Nothing about it fits a Worker deployment, and every local setup, CI run and codespace paid for it.

What had to survive the move: the server stays a relying party, sessions stay app-side, the CLI/MCP device flow and PATs are untouched, and no JWT is validated per request.

## Decision

The identity provider is **`@org/identity`**, a Cloudflare Worker running **Better Auth 1.7** with its `jwt` plugin and `@better-auth/oauth-provider`. It replaces Zitadel one for one, as the OIDC issuer:

- **Its own deployable and its own database.** The Worker reaches its Postgres through the `identity-hd` Hyperdrive (caching off), with Better Auth's Kysely adapter over a `pg` Pool built per request and closed once background tasks settle. Nothing else reads its tables. Locally `alchemy dev` serves it on :3002 and passes Hyperdrive through to the docker Postgres; `pnpm db:migrate` runs Better Auth's migrations after the app's.
- **A plain Worker with server-rendered pages**, not SvelteKit: sign in, sign up, verify email, reset password and a consent fallback are HTML forms the Worker renders and handles itself. The router speaks a narrow `IdentityAuthPort`, so it is unit-tested with fakes, and an integration suite runs Better Auth against a real database.
- **Open sign-up behind email verification.** Better Auth's id_token carries no email by default; the Worker adds `email` and `email_verified` through `customIdTokenClaims`, which is what the server reads.
- **Mail** goes through Mailpit's HTTP send API locally and the Cloudflare Email binding once deployed.
- **The app is a trusted first-party client.** The seed endpoint (`POST /internal/seed`, present only when `IDENTITY_SEED_TOKEN` is set) registers it with a deterministic client id and secret, `skip_consent` and `enable_end_session`, and creates verified users. `pnpm seed:identity` and the acceptance global setup both go through it, via `@org/identity`'s `seed-client.ts`.
- **The server repoints, it does not change shape.** `IDENTITY_*` replaces `ZITADEL_*`; the OIDC client reads email and `email_verified` off the id_token and accepts a custom fetch for the Worker port; new identities are recorded with provider `better-auth`. An unknown subject whose **verified** email matches an existing user is linked to that user, rather than refused. The callback keeps the id_token in an HttpOnly cookie so logout can pass it as `id_token_hint`, which lets the issuer end its session without a confirmation page.
- **Fenced.** A repo-wide `deny` keeps `better-auth` and `@better-auth/*` inside `@org/identity`.

## Consequences

- No Zitadel container, PAT, masterkey or management API anywhere. A fresh setup is `pnpm bootstrap`; acceptance needs `pnpm dev:cf` running.
- The identity UI is plain HTML for now. It adopts the Svelte component library when that exists, and could move to SvelteKit once the kit-3 / Vite-8 / TypeScript-6 toolchain is in the repo for the web app.
- Better Auth refuses plain-http redirect URIs for `web` clients, localhost included, so a loopback-only registration is made as a `native` client. Deployed stages use https and `web`.
- Linking by verified email means the issuer's verification is trusted: an account at the issuer whose address the issuer verified can sign in as the app user with that address. Unverified addresses never link.
- Hashing runs in workerd's pure-JS scrypt; sign-in and sign-up cost real CPU per request on a deployed Worker.

## Alternatives considered

- **SvelteKit for the identity pages** (`Cloudflare.Website.SvelteKit`). Rejected for now: kit 3 needs Vite 8 and TypeScript 6 beside the repo's Vite 6 and TypeScript 5.9, Alchemy's SvelteKit dev path does not bind Hyperdrive, goodbones cannot read `.svelte` files, and SSR runs in Node rather than workerd under `alchemy dev`.
- **`@alchemy.run/better-auth`'s `CloudflareHyperdrive` layer.** It imports the Alchemy runtime, so the identity code would have to live in `@org/infra` or carve a broad exception into the Alchemy fence — for the same per-execution `pg` Pool built here in a few lines.
- **Invite-only sign-up.** `disableSignUp` also blocks the server-side sign-up the seed uses, and the app already provisions ordinary users on first sign-in.

## Related

- ADR-0016 (superseded), ADR-0017 (amended: the IdP is the identity Worker; Playwright drives its pages; logout carries an `id_token_hint`), ADR-0018 (the server stays the auth authority behind Next).
