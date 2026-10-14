# ADR-0038: Postgres on Neon, reached through Hyperdrive

- Status: Accepted
- Date: 2026-10-11
- Amends: ADR-0011 (migrations run against a stage's direct URL as a deploy step, over TLS when the URL asks for it).

## Context and Problem Statement

The Workers (ADR-0034, ADR-0035) need a Postgres that a deploy can create per stage and throw away per pull request, and a way to reach it from workerd without a pool that outlives a request. Locally, everything still runs against the docker Postgres that the integration suites use.

## Decision

**Each database is a Neon project per long-lived stage and a branch per preview, in front of which sits a Hyperdrive configuration.** `packages/infra/src/stack/databases.ts` declares both, for the app database and the identity database.

- **Long-lived stages (`staging`, `prod`)** each own a `Neon.Project` per database in `aws-us-east-2`, retained on destroy (`Alchemy.RemovalPolicy.retain()`), since `Neon.Project` has no `protected` flag.
- **A preview stage (`pr-<n>`)** branches staging's project with `initSource: "schema-only"` and `expiresAt` a week out, so a preview never sees staging's rows and an abandoned one deletes itself. Staging must therefore be deployed before the first preview.
- **Hyperdrive points at the direct, unpooled origin, with caching off.** Hyperdrive is the pooler, so a second pooler (Neon's PgBouncer) only adds a hop and its transaction-mode limits. The app relies on read-your-writes, which a cached answer would break.
- **Compute is capped.** A preview branch declares its read-write endpoint with a 0.5 CU autoscaling ceiling. `Neon.Project` cannot configure its default branch's endpoint, so an Alchemy `Action` patches that endpoint to a 2 CU ceiling once the project exists, through the Neon API.
- **The Workers sit beside the database.** The server and identity Workers carry `placement: { region: "aws:us-east-2" }`. Both make several round trips per request, and placement applies to `fetch`, which is how the web Worker's service binding calls them. The web Worker stays at the edge.
- **Migrations stay forward-only TypeScript (ADR-0011), run from Node against the direct URL.** The stack outputs each stage's direct connection URLs, redacted, under the names the migrate scripts read (`DATABASE_URL`, `IDENTITY_DATABASE_URL`). The deploy pipeline (ADR-0039) exports them and runs `pnpm db:migrate`, which connects over TLS when the URL says `sslmode=require`, as Neon's does.
- **Locally there is no Neon.** Under `alchemy dev` the stack skips Neon and points each Hyperdrive's origin at the docker Postgres named by `DATABASE_URL` / `IDENTITY_DATABASE_URL`.

## Consequences

- A preview costs two Neon branches, one per project. Neon's branch cap per project bounds how many previews can be open at once, which is one reason previews are opt-in by label (ADR-0039).
- Staging's data never reaches a preview, and a preview's data dies with it. Acceptance against a preview seeds its own users.
- The `Action` that caps a long-lived project's compute runs only when its input changes. A ceiling changed by hand in the Neon console stays until the next change to the declared one.
- Advisory locks are out: Hyperdrive lists them as unsupported (ADR-0035).

## Alternatives considered

- **Neon's pooled URL behind Hyperdrive.** Two poolers in a row, with PgBouncer's transaction-mode restrictions applied twice.
- **Hyperdrive caching on.** Cheaper reads, at the price of a command's own write being invisible to the read that follows it.
- **Alchemy's `migrations` option on `Neon.Project`/`Neon.Branch`.** It applies SQL directories or Drizzle schemas, not the Effect `PgMigrator` modules this repo writes.

## Related

ADR-0011, ADR-0020, ADR-0034, ADR-0035, ADR-0039.
