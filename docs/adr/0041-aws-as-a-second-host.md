# ADR-0041: AWS as a second host

- Status: Accepted (implemented, not yet deployed)
- Date: 2026-10-15
- Builds on: ADR-0035 (the server on Workers), ADR-0034 (the identity Worker), ADR-0037 (the SvelteKit renderer), ADR-0038 (Neon), ADR-0039 (stages)

## Context and Problem Statement

Every use case reaches the platform through a port: the `DomainEventQueue` the outbox relays to, the `Mailer`,
the `Database` client, the `ExecutionContext` for detached work, the `IssuerTransport` to the identity
provider. Only three files know they run on Cloudflare — the two Worker entrypoints and the stack. If the
hexagon is real, a second host should need new adapters and a new composition root, and nothing else.

Alchemy, which already declares the Cloudflare stack, ships an AWS provider (Lambda, SQS, SES, EventBridge,
CloudFront, Route 53, ACM, and SvelteKit on Lambda behind CloudFront). The question is what the AWS shape of
each Cloudflare resource is, and which of the application's seams need a second adapter.

## Decision

**A second, deploy-only Alchemy stack, `packages/infra/aws.run.ts` (`hexagon-aws`), runs the same application
on AWS.** `pnpm deploy:aws --stage <s>` / `pnpm destroy:aws --stage <s>`. The Cloudflare stack, the dev loop
and CI are unchanged; `pnpm dev` keeps running the Cloudflare stack, which serves the same code.

| Cloudflare                                      | AWS                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| server Worker (`fetch`, `queue`, `scheduled`)   | one Lambda (`platform/lambda/main.ts`): Function URL, SQS event sources, EventBridge rules   |
| identity Worker                                 | a Lambda behind CloudFront on `auth.<stage>.<domain>` (`AWS.Website.SsrSite`)                |
| SvelteKit on a Worker, `SERVER` service binding | `AWS.Website.SvelteKit` (Lambda + S3 + CloudFront), `SERVER_URL` = the server's Function URL |
| Cloudflare Queue + DLQ, 10 retries              | SQS queue + DLQ, redrive after 11 receives, `ReportBatchItemFailures`                        |
| `* * * * *` / `0 * * * *` crons                 | `rate(1 minute)` / `cron(0 * * * ? *)` rules sending `{"job": …}`                            |
| Email binding (`send_email`)                    | SES v2 `SendEmail` on a domain identity with DKIM records in Route 53                        |
| Hyperdrive in front of Neon                     | Neon's own PgBouncer endpoint (`pooledConnectionUri`), over TLS                              |

What changed in the application, by seam:

- **`DomainEventQueue`** gains `SqsDomainEventQueueLive`. It shares the batching with the Cloudflare adapter
  (`events/queue-batches.ts`, now parameterised by the queue's limits: 10 entries and 256 KiB for SQS) and
  hands back the envelopes SQS refused per entry, which the outbox keeps for the sweeper exactly as before.
- **The queue consumer** is untouched. The Lambda root translates an SQS batch into its `QueueMessage`s:
  `attempts` is `ApproximateReceiveCount`, `ack` records nothing (an unreported message is deleted), and
  `retry` reports a batch item failure and sets the message's visibility timeout to the consumer's backoff.
- **`Mailer`** gains `MAILER=ses` (`SesMailerLive`, behind the same daily cap as the paid Cloudflare
  transport). The identity issuer gains an SES `EmailDelivery` beside its binding one.
- **AWS is spoken over the wire, not an SDK.** `globals/infrastructure/aws/` holds SigV4-signed calls
  (`aws4fetch`) over Effect's `HttpClient`: `SendMessageBatch`, `ChangeMessageVisibility`, `SendEmail`.
  Credentials are the execution role's, which the Lambda runtime sets in the environment.
- **`DatabaseLive`** reads `DATABASE_SSL` (default off, as behind Hyperdrive); every deployed host is still
  behind a transaction-mode pooler, so prepared statements stay off.
- **The web app's one platform file** falls back from the `SERVER` service binding to `SERVER_URL` when
  there is no Worker platform, keeping the request's path and query and swapping its origin.
- **A Lambda composition root per deployable**, beside the Worker one and shaped like it: the application is
  built per invocation over a fresh `MemoMap` (ADR-0035's option A), and every background task settles before
  the handler returns, since Lambda freezes the process afterwards instead of honouring `waitUntil`. Each
  root decodes its event with a schema and dies on anything it does not serve.

Nothing under `modules/` changed.

### Hosts

Every AWS stage answers on its own subdomains — `app.<stage>.<APP_DOMAIN>` and `auth.<stage>.<APP_DOMAIN>`,
bare for `prod` — in the Route 53 zone `AWS_HOSTED_ZONE_ID`. A preview cannot use the CloudFront default
domain the way a Cloudflare preview uses `workers.dev`: the issuer has to know its own URL, and the server its
redirect URI, before the distributions that would name them exist. The server needs no domain: only the web
function calls it.

## Consequences

- The application's platform surface is now demonstrably the set of seams in `globals/infrastructure/`; a
  third host is a third composition root plus whatever adapters its queue and mail need.
- The server's Function URL is public (`authType: NONE`). It serves exactly the API the browser reaches
  through `/api/*`, so it exposes nothing new, but it is reachable without the web app's rate limits.
  Signing the web function's calls with IAM (`AWS_IAM`) is the next step if that matters.
- Secrets are Lambda environment variables (encrypted at rest under the account's key), not Secrets
  Manager references.
- SES starts in its sandbox: until production access is granted, only verified recipients receive mail. The
  identity is shared by every stage in the account, adopted and retained like the Cloudflare zone.
- There is no Cloudflare zone in front, so the rate limits, kill switch and usage alert of ADR-0039 have no
  AWS counterpart yet (WAF on the distributions would be one).
- There is no `alchemy dev` for the AWS stack, and no CI workflow deploys it; both were out of scope.

## Verification

Not deployed. The server and identity Lambda entries were bundled with rolldown under the conditions
Alchemy's Lambda bundler uses (`node`, `module`, `default`) and invoked under Node 24 against the local
Postgres: the server answered a Function URL request, ran both scheduled jobs and consumed an SQS batch; the
issuer served its OIDC discovery document and sign-in page. Bundling under the `import` condition instead
breaks `pg`'s CommonJS interop, which is worth knowing if the bundler settings ever change.

## Alternatives considered

- **RDS or Aurora instead of Neon.** A Lambda reaching RDS sits in a VPC, which then needs a NAT gateway to
  reach Stripe, the issuer and SES — a standing cost and a new network tier for no change in the
  application. Neon already runs on AWS, beside the functions in `us-east-2`.
- **The AWS SDK v3.** The Node runtime ships it, but naming it would put an SDK into the server's types and
  tests for three calls; a signed `HttpClient` request is testable with the same fake client the Mailpit
  adapter uses.
- **API Gateway in front of the server.** A Function URL is enough for a single caller and adds nothing to
  configure.

## Related

- ADR-0035 — the per-invocation composition the Lambda roots copy.
- ADR-0007 — the durable outbox whose relay now has a third queue adapter.
