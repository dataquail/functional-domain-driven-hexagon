# ADR-0035: The server on Cloudflare Workers

- Status: Accepted; amended by [ADR-0039](0039-deploy-pipeline-stages-and-limits.md) — `workersDev` now serves previews and the server Worker on staging; deployed stages turn on Workers Observability
- Date: 2026-10-11
- Amends: ADR-0007 (after-commit delivery crosses a Cloudflare Queue), ADR-0012 (spans export over fetch, per invocation), ADR-0018 (Next's rewrite targets the server Worker).

## Context and Problem Statement

The server was a long-running Node process: one `pg` pool per process, a `NodeHttpServer`, a `Layer.launch` retry loop, an outbox sweeper on a forked timer, and `@org/jobs` as a second process on `Schedule.cron`. The Cloudflare migration moves it into a Worker reached over a service binding, beside the identity Worker (ADR-0034).

A Worker has no process lifetime. An I/O object — a socket, a timer, a pending promise — belongs to the request that created it, and touching it from another request is an error. Every repository captures `Database.Database` when its layer is built, so a pool built once per isolate would carry the first request's socket into every later one. The first decision, therefore, is **where the database client lives**, and with it where the application layer lives.

## Spike: one database client per invocation

Two designs were measured against the real application layer (every module, the buses, the durable unit of work, the HTTP API) over a Postgres 16 container, 300 iterations after 20–30 warm-ups, requesting `GET /orgs` (auth middleware, one query, JSON encode).

- **(A) Rebuild the application layer per invocation**, over a fresh `MemoMap`, with a client built for that invocation.
- **(B) Build the application once per isolate**, and give each invocation a fresh client behind a `Database` that resolves the current client per statement.

Node 22.21, CPU per request (`process.cpuUsage`):

| Arm                                                   | p50     | p90     |
| ----------------------------------------------------- | ------- | ------- |
| A: build layer + client, serve, dispose               | 4.11 ms | 9.82 ms |
| B: warm application, fresh client + `SELECT 1`, serve | 1.39 ms | 2.85 ms |
| Warm application over a shared pool (lower bound)     | 0.13 ms | 0.49 ms |
| Layer build + dispose alone, no I/O                   | 1.28 ms | 7.02 ms |

**A − B at the median: 2.72 ms.**

workerd 1.20260918.1 (the binary `alchemy dev` runs), compatibility date 2026-08-31, the same layer bundled with esbuild (1.45 MB minified, 410 KB gzip). workerd exposes no CPU clock, so these are wall times measured by the caller:

| Arm                                 | p50          | p90          |
| ----------------------------------- | ------------ | ------------ |
| Layer build + dispose alone, no I/O | 1.08–1.30 ms | 1.35–1.90 ms |
| Fresh client + `SELECT 1`           | 7.21–8.48 ms | 9.67–13.0 ms |
| A: build, serve `/orgs`, dispose    | 12.19 ms     | 15.6–16.2 ms |

The build arm does no I/O, so its wall time is CPU: **rebuilding the application costs about 1.1 ms per invocation in workerd**. The connection dominates either way — opening one includes SCRAM's PBKDF2 — and both designs pay it.

The decision rule fixed before the spike was "A wins unless its median added CPU exceeds about 5 ms". It does not, on either runtime.

Two further findings decided what B would cost beyond its CPU:

- **`toWebHandler` builds its layer eagerly, in whatever context calls it.** Effect issue #6319 (open, filed against v3) describes a lazily memoised build inside an aborted first request hanging the isolate. In 4.0.2 the lazy `??=` path is gone, but a long-lived handler is still built inside the first request's I/O context and its failure is cached. Its pool, the pool's idle timers and the OTLP exporter's export loop would all belong to that request.
- **Nothing in Effect delegates a `SqlClient` per statement.** B needs a hand-written client (~40 lines over `SqlClient.make` with a `Context.Reference` acquirer) that loses the driver's pool and multiplexing and every `PgClient`-specific member.

## Decision

**(A): the server Worker builds its whole application layer per invocation.** Each `fetch`, `queue` and `scheduled` call creates a fresh `MemoMap`, builds the application over a database client opened for that invocation, runs, and disposes the scope once the response and every `waitUntil` task have settled. Nothing a request creates outlives it.

- **The client is `@effect/sql-pg`'s own driver over `node:net`**, which runs unchanged in workerd under `nodejs_compat` (on by default since 2026-08-04). It connects to `env.APP_DB.connectionString`; Hyperdrive terminates TLS to the origin, so the Worker's leg is plaintext.
- **`Database.layer({ …, behindTransactionPooler: true })`** turns off named prepared statements, which a transaction-mode pooler does not carry between transactions, and caps the client at two connections, since Hyperdrive owns reuse.
- **No timers in the application layer.** The outbox sweeper moves from a forked loop to the `* * * * *` cron; jobs run from `scheduled`; detached work goes through `ExecutionContext.waitUntil`.
- **One file sees the platform.** `packages/server/src/platform/worker/main.ts` is the only server file that reads `env`/`ctx` or names the Workers binding types, enforced by the manifest. It exports its three handlers as the default and nothing else by name, because workerd reads every named export as another entrypoint. What the code below it needs from the platform arrives through seams in `globals/infrastructure/runtime/` that default to plain-process behaviour — `ExecutionContext` (detached work), `IssuerTransport` (the identity service binding), `EmailBinding` — and through a `ConfigProvider` over the string bindings, with `DATABASE_URL` taken from `APP_DB.connectionString`.
- **The three handlers.** `fetch` serves `HttpRouter.toWebHandler` over the HttpApi. `queue` decodes each message as an `Event.Envelope` and runs `deliverOnce` behind the `DeliveryLedger`: success acks, an envelope no subscription answers acks (retrying cannot help), anything else retries after `2^attempts` seconds capped at 15 minutes; the consumer allows 10 retries and dead-letters to `domain-events-dlq`, whose own consumer reports each message to `UnhandledFailures` and acks it. `scheduled` runs the outbox sweep on `* * * * *` and the session purge on `0 * * * *`.
- **After-commit delivery crosses a Cloudflare Queue.** The outbox relay sends through a `DomainEventQueue` that awaits `sendBatch` in chunks of at most 100 messages and 256 KB, and leaves anything it could not send — including an envelope over the 128 KB message limit — for the sweeper. Tests keep the in-process queue.
- **A module's event subscriptions are their own layer.** `<Feature>Module.events` carries its `interface/events/` adapters, and every composition provides it. They used to ride in `http`, so a queue invocation, which builds no HTTP surface, had no subscriptions and answered every envelope `unknown-subscription`.

Decisions made alongside the spike:

- **Mail** goes through the Cloudflare Email Service `send_email` binding once deployed and Mailpit's HTTP send API locally. The server and the identity Worker each keep their own adapter: the transport is a few dozen lines, and a shared package would couple two deployables for that. nodemailer and the SES adapter are deleted.
- **Tracing** exports over fetch to Jaeger under `alchemy dev`, and is off on deployed stages until a collector is chosen. Each invocation flushes its spans through `waitUntil`.
- **Non-production stages enable `workersDev`** so a locally run Next (and the acceptance suite) can reach a deployed server Worker until the web Worker arrives with its service binding. Production keeps no public route.
- **Workerd smoke tests use Alchemy's `Test.make({ dev: true })`.** `@cloudflare/vitest-pool-workers` peers on vitest ^4.1 and cannot run under the repo's vitest 5.
- **The session-purge job drops `pg_try_advisory_xact_lock`.** Hyperdrive lists advisory locks as unsupported, and the job's DELETE is idempotent, so a duplicate run costs nothing. `@org/jobs` is a library of job Effects; its process entrypoint is gone.
- **A failed invitation email is retried, not swallowed.** The invitation mailer used to log and absorb a transport failure so a mail outage could not fail an invite. Durable delivery already keeps it from failing the invite, so the failure now surfaces (`InvitationEmailUndelivered`) and the queue retries it.

## Consequences

- Every invocation pays for a connection (several milliseconds, mostly SCRAM) and about a millisecond of layer construction. Neither is shared, so neither can leak between requests.
- A cold layer per request means the bus, the policy registry and every module are rebuilt each time. Anything a module caches in a layer (a discovered OIDC configuration, a compiled schema) is per request now; the OIDC discovery document is the one that costs a round trip, and it travels over the identity service binding.
- Sagas and event streams stay in-process. `Saga.runner` forks into the layer scope, which ends with the request, so the library documents them as unavailable on Workers; none exist today.
- Unit and integration suites stay on Node vitest against docker Postgres. `pnpm test:workers` boots the stack under workerd with `Test.make({ dev: true })` and drives `fetch`, `queue` and `scheduled` over HTTP; it needs the docker Postgres and free dev ports, so it is a named gate beside `check:all` rather than part of it. The acceptance suite runs against the server Worker: Playwright boots `alchemy dev` itself, pointing the app Hyperdrive at the test database.
- `node:crypto` HMAC, `timingSafeEqual`, SHA-256, `randomBytes`, `randomUUID` and `Buffer` base64url all run in workerd unchanged. AES-GCM works too, but nothing in the server uses it; the one divergence found is that workerd's `cipher.update(string)` needs an explicit input encoding.
- Stripe runs on its fetch HTTP client and verifies webhooks with `constructEventAsync` over SubtleCrypto: the worker build of the SDK has no synchronous HMAC.

## Alternatives considered

- **(B) A stable application over a per-invocation client.** About 1–3 ms cheaper per request, at the price of a hand-written delegating client and an application whose timers and failures belong to the first request it served.
- **A module-scope build.** workerd forbids I/O and timers outside a request, so a layer that opens a pool or starts a timer cannot be built there.
- **`postgres` or `pg` instead of `@effect/sql-pg`.** Unnecessary: the Effect driver runs in workerd as it is, and it is what every repository already speaks.

## Related

ADR-0007, ADR-0012, ADR-0018, ADR-0020, ADR-0034. The spike's harness and raw output are not kept in the repository; the numbers above are its record.
