# ADR-0039: The deploy pipeline, its stages, and the limits on what a stage may spend

- Status: Accepted
- Date: 2026-10-11

## Context and Problem Statement

The application is three Workers, two Neon databases, a Hyperdrive in front of each and a pair of queues, all declared by one Alchemy stack (ADR-0035, ADR-0038). Nothing deploys it yet. It needs per-pull-request environments the acceptance suite can run against, a path to production with a human in it, and bounds on what a bug, an attack or a runaway retry can cost, since Cloudflare has no spending cap for Workers.

## Decision

### Stages and hosts

- **`prod`** answers on `app.<APP_DOMAIN>` and `auth.<APP_DOMAIN>`; **`staging`** on `app.staging.<APP_DOMAIN>` and `auth.staging.<APP_DOMAIN>`. Each Worker's custom domain lives in the existing zone, which the stack adopts and never deletes; the zone must be on Cloudflare. A long-lived stage turns `workers.dev` off for the web and identity Workers so nothing bypasses the zone's rules. The server Worker has no public route in production (ADR-0035).
- **A preview, `pr-<n>`,** answers on `workers.dev`. Each Worker is named `hexagon-<stage>-<role>`, so its URL follows from the stage and the account's `workers.dev` subdomain (`CLOUDFLARE_WORKERS_SUBDOMAIN`), and a pull request never touches DNS.
- **Every URL a Worker or the pipeline needs is computed** from the stage and those two values (`packages/infra/src/stage.ts`): the app URL, the issuer, the OIDC redirect and post-logout URIs. Locally they still come from `.env`.

### Workflows

- **`preview.yml`**: a same-repository pull request labelled `preview` deploys `pr-<n>` (the `deploy-stage` action: deploy, export the stack's outputs through `scripts/stage-env.mjs`, migrate), seeds the app's OAuth client and admin through the identity Worker's seed endpoint, and runs the acceptance suite against the stage URL (`ACCEPTANCE_BASE_URL`; the suite refuses any stage but `pr-<n>`, since it truncates tables). Removing the label or closing the pull request destroys the stage.
- **`deploy.yml`**: a green CI run on `main` deploys `staging`, seeds and smoke-tests it (`scripts/smoke-stage.mjs`), then `prod` once a reviewer of the `production` environment approves.
- **Runs for one stage are serialised** with a concurrency group that never cancels: `Cloudflare.state()` takes no lock, and a cancelled deploy leaves resources half-applied.
- **Secrets live in GitHub environments** (`preview`, `staging`, `production`), so a preview never holds production's. The state store is bootstrapped once, by hand (`alchemy provider cloudflare bootstrap`); `deploy --yes` would also create it.
- **The seed endpoint is a back door.** Previews and staging keep their seed token; production's is set for the first deploy only, to register the app's client and admin, and then deleted.

### Limits

| Limit                  | Where                                                                                                   | Value                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| CPU per invocation     | each Worker's `limits.cpuMs`                                                                            | web 200 ms, identity 1 s (password hashing), server 100 ms                                         |
| Sign-in / sign-up rate | zone `http_ratelimit` rule over the identity hosts' `/api/auth/sign-*` and the app hosts' `/api/auth/*` | 20 a minute per IP and data centre, then blocked 10 minutes                                        |
| Neon compute           | ADR-0038                                                                                                | 2 CU long-lived, 0.5 CU preview                                                                    |
| Email                  | a daily count in each Worker's database, checked before the paid transport sends                        | `MAIL_DAILY_CAP`, 200 by default                                                                   |
| Queue retries          | the domain-events consumer                                                                              | 10 retries, then the dead-letter queue                                                             |
| Spend                  | a `billing_usage_alert` notification policy                                                             | `USAGE_ALERT_PRODUCT` / `USAGE_ALERT_LIMIT`, mailed to `USAGE_ALERT_EMAIL` and an optional webhook |
| Kill switch            | a zone custom rule blocking every app and identity host                                                 | off unless `KILL_SWITCH=true`                                                                      |

- **The prod stage owns the zone's rules for staging too.** A ruleset owns its whole phase, and staging lives in the production zone, so two stages declaring one would overwrite each other.
- **The kill switch is a repository variable.** Every prod deploy applies `KILL_SWITCH`, so a later deploy never lifts it on its own, and `kill-switch.yml` applies it at once by deploying only the `kill-switch` rule (`--include kill-switch`). A usage alert tells a person; turning the switch is that person's call.
- **The email cap sits outside the transports** (`email/quota/` in the server, `daily-capped-mailer.ts` in identity), so a transport still never reaches the database. A send the transport refuses still counts, which errs toward sending less.

### Observability

**Effect spans are exported only locally, to Jaeger.** Deployed stages turn on Workers Observability (logs, invocation logs and traces) on every Worker and export no OTLP until a collector is chosen.

## Consequences

- The first deploys are manual decisions: bootstrap the state store, deploy staging (previews branch from it), then prod with the seed token set once. `docs/dev-setup.md` lists the variables each environment needs.
- The rate limit's hostname match and the usage alert need a paid zone plan (Pro or above) and pay-as-you-go billing; the Free plan's single rate-limit rule matches only on path.
- The product ids the usage alert accepts are not documented outside the account's own `available_alerts` listing, so the stack takes them as configuration rather than guessing.
- Previews do not cover fork pull requests: their code never receives the deploy secrets.
- The pipeline is proven by `actionlint` and `act` dry runs; nothing has deployed it yet.

## Alternatives considered

- **A preview for every pull request.** Every open pull request would hold two Neon branches, and Neon caps branches per project.
- **Repository- or organisation-level secrets.** One set of credentials for every stage; a preview's code could read production's.
- **A webhook that engages the kill switch automatically.** A billing alert arrives once a day at best; letting it block the site with no one looking trades a cost risk for an availability one.
- **An OTLP collector now.** Grafana Cloud or Honeycomb would carry Effect's spans, at the price of a vendor account and a secret per stage, before anyone has needed them.

## Related

ADR-0034, ADR-0035, ADR-0037, ADR-0038.
