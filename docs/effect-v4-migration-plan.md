# Implementation Plan: Migrate to `effect-smol` (Effect v4)

**Status:** Proposed · **Appetite:** Large (single long-lived branch, unlimited) · **Posture:** Full modernization showcase · **Scope:** Entire monorepo

> ⚠️ This plan was produced from the `/plan` workflow **without a prior `/explore` session on a tracked issue**. The research below stands in for exploration, but if a GitHub issue exists, link it and reconcile.

---

## 0. Session handoff — START HERE (last updated after commit `2d4886c`)

**Goal:** migrate the whole monorepo from `effect@3.21.2` to `effect@4.0.0-beta.94` (effect-smol). Decisions locked: **full modernization** posture, **entire monorepo**, **pin `4.0.0-beta.94`**, **supersede ADR-0012** (use-case `Effect.fn` spans). Details in §1.

**Where we are:** branch `chore/effect-v4-migration` (off `main`), working tree **clean**, 4 commits:

1. `184bd79` chore — dep flip + codemod tooling + this plan
2. `370a692` refactor — mechanical codemod diff (174 files; `--no-verify`, intentional WIP)
3. `dab2dbd` refactor — hand-migrated HttpApi middleware + pilot contract (proven exemplars)
4. `2d4886c` docs — recipe + resume guide + SchemaUtils findings

**Done:** Phase 0 (spike, all APIs validated) + Phase 1 (dep flip + 4 codemods). **In progress:** Phase 2 (contracts → green). **Proven-clean under v4:** `wallet.root.ts`, `contracts/src/Policy.ts`, `contracts/src/api/CliOrganizationContract.ts`.

**Immediate next task:** get `@org/contracts` to typecheck. Baseline **177 errors** across 13 files; do them in this order (SchemaUtils first — others depend on it):
`SchemaUtils.ts` (61, hardest — see §3.4) → `OrganizationContract` (30) → `AuthContract` (15) → `UserContract` (14) → `DomainApi` (11) → `Todos`/`CliTodos`/`Billing` (7 each) → `CliAuth` (4) → `CliApi`/`ManualCache`/`CustomHttpApiError`/`Control` (1–2 each, likely unused-import cleanup).

**How to work (per package, topological order — see §3.3):**

```bash
bash scripts/codemods/run-all.sh                              # regenerate the mechanical base (idempotent) if ever reset
pnpm -F @org/contracts exec tsc -b tsconfig.json --force      # the green gate for contracts; then database → api-client → server → …
```

Apply the **verified v4 recipe** by hand: HttpApi options-object + middleware (§3.2), SchemaUtils transform/Codec (§3.4). Then remaining contracts are the same HttpApi recipe repeated — consider a 5th codemod for the endpoint fluent→options collapse if it gets tedious.

**Gotchas (learned the hard way):**

- **Don't** run a broad `eslint --fix` on mid-migration code — it strips imports the not-yet-migrated code still needs. Commit WIP with `git commit --no-verify` (the pre-commit hook runs `eslint --fix`).
- `build/` dirs are stale compiled artifacts (gitignored); `tsc -b` regenerates them — ignore them.
- `web` typechecks against the **built** `@org/contracts` — rebuild contracts before checking web.
- Final verification needs a DB: `DATABASE_URL_TEST=… pnpm test:integration` (env recipe is in the assistant's project memory).
- A throwaway sandbox with the beta installed (for reading `.d.ts`) may still be at `…/scratchpad/effect-v4-spike`; if gone, recreate with `npm i effect@4.0.0-beta.94 @effect/platform-node@4.0.0-beta.94 @effect/vitest@4.0.0-beta.94` in a temp dir and read `node_modules/effect/dist/**/*.d.ts` — the authoritative API source.

**Manual (non-codemod) items still pending anywhere they appear:** 8 `Effect.Service`→`Context.Service` (`make:`+`static layer`), 2 `FiberRef`→`Context.Reference`, 4 `Schema.int`→`Schema.Int`, 2 `Schema.Union(a,b)`→`Schema.Union([a,b])`, 6 `Schema.Literal(a,b,…)`→`Schema.Literals([…])`.

---

## 1. Goal & context

Move the monorepo from `effect@3.21.2` (+ the `@effect/*` companion packages) to **`effect@4.0.0-beta.94`** (`effect-smol`). v4 is experimental but this is an example repo, so the beta is acceptable. The payoff: comprehensive tree-shaking (a minimal Effect program is ~6.3 KB gzipped, ~15 KB with Schema) and a consolidated, separately-installable ecosystem.

**Decisions locked in (from planning Q&A):**

- **Idiom posture — full modernization showcase.** Do the mechanical migration _and_ adopt v4 best-practice: `Effect.fn`/`Effect.fnUntraced` named tracing, the `Context.Service` `make`/`layer` pattern, `effect/unstable/observability` (Otlp) replacing `@effect/opentelemetry`, `use` accessors where they read well.
- **Scope — entire monorepo.** `contracts, database, server, jobs, cli, mcp, api-client, web, components, acceptance` all green on one branch.

**Modernization guard-rail (code smells):** "Full modernization" means _adopt idioms v4 makes natural_, **not** gold-plate. Actively avoid **Speculative Generality** (G — abstractions/hooks for use cases that never materialize), **Divergent Change** (don't fold unrelated cleanups into migration commits), and **Shotgun Surgery** done by hand (that's what the codemods are for). Every new abstraction must earn its place against a real call site.

---

## 2. The central constraint (why this is not a classic vertical slice)

Our house style is vertical slices, and we honor it _within_ this migration — but the migration's spine is unavoidably horizontal, and pretending otherwise would produce a dishonest plan:

- The root `package.json` `pnpm.overrides` pins **one** `effect` version for the whole workspace. There is no "package A on v4, package B on v3" — flipping the override flips everyone at once.
- `@org/contracts` exports **Schema types** consumed by `server`, `web`, `api-client`, `cli`, `jobs`. A v4 `Schema.Schema<A>` is not type-identical to a v3 one, so the type-sharing graph must move together.

**Therefore:** one dependency flip on a long-lived branch, then restore green in **topological dependency order**, and — this is where vertical slicing lives — prove the whole mapping on **one thin end-to-end module first** (`wallet`) before fanning out. CI stays red on the branch between the flip and the last package; the "unlimited appetite / large PR" decision makes that acceptable. We keep the diff reviewable by committing the **mechanical codemod diff separately** from hand-written structural changes.

**TDD framing (per the TDD doc):** the bulk of this is _refactoring under a green test net_ — the red→green→refactor loop operates at migration scale (the existing suite goes red on the flip; we restore it green file-by-file). Phase 0 is an explicit **spike** (the doc endorses spike-first for exploratory work, then delete). For **structural** rewrites where behavior can actually shift — domain ops moving `Either`→`Result`, `Context.Tag`→`Context.Service`, `HttpApiBuilder` handlers — we adjust/write the test _first_, watch it fail against the new shape, then make it pass. We **run the touched file's test after every file change** (the skill's hard requirement).

---

## 3. Migration surface (measured against the codebase)

| Change                                                                                                                                          | Sites                 | Nature                                                                                                                                      | Codemod?                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `Schema.TaggedError` → `Schema.TaggedErrorClass`                                                                                                | 259                   | rename                                                                                                                                      | ✅                                 |
| `Context.Tag` (class) + `Effect.Service` (8) → `Context.Service`                                                                                | 121                   | **structural** (arg-order flip `Context.Service<Self,Shape>()(id)`; `Effect.Service` → `make` + explicit `Layer`)                           | ⚠️ AST-assisted, human-verified    |
| `effect/Either` → `effect/Result`                                                                                                               | 41 imports / 180 uses | rename + constructor/matcher API (`left/right` → `fail/succeed`, `Either.match`) — touches the domain's core `Result<_, DomainError>` idiom | ⚠️ AST-assisted                    |
| `@effect/platform/HttpApi*` → `effect/unstable/httpapi/*`                                                                                       | ~53                   | path move                                                                                                                                   | ✅                                 |
| `@effect/platform/HttpServer*`, `HttpServerRequest/Response`, `HttpClient*`, `HttpMiddleware` → `effect/unstable/http/*`                        | ~15                   | path move                                                                                                                                   | ✅                                 |
| `Schema.annotations` → `Schema.annotate` + `.annotations(` method → `.annotate(`                                                                | ~97                   | rename                                                                                                                                      | ✅                                 |
| `Effect.catchAll`→`catch`, `catchAllCause`→`catchCause`                                                                                         | 13                    | rename                                                                                                                                      | ✅                                 |
| `Schema.decode`→`decodeEffect`, `decodeUnknown`→`decodeUnknownEffect`, `encode`/`encodeUnknown` likewise                                        | ~15                   | rename                                                                                                                                      | ✅ (confirm encode names in spike) |
| `Schema.encodedSchema`→`toEncoded`, `typeSchema`→`toType`, `between`→`isBetween`, `DateFromSelf`→`Date`                                         | ~14                   | rename                                                                                                                                      | ✅                                 |
| `FiberRef` → `Context.Reference`                                                                                                                | 2 files               | structural                                                                                                                                  | ⚠️ manual                          |
| `@effect/opentelemetry/NodeSdk` → `effect/unstable/observability` (Otlp)                                                                        | 1                     | rewrite (modernization)                                                                                                                     | manual                             |
| `Schema.brand`                                                                                                                                  | 440                   | ✅ **API-compatible** (spike-validated) — `.pipe(Schema.brand("X"))` unchanged                                                              | no change                          |
| `Schema.Class` (154), `Schema.Struct` (220), `Schema.Literal` (75)                                                                              | 449                   | ✅ **compatible** (spike-validated); only `.annotations(`→`.annotate(` on them                                                              | ✅ rename only                     |
| **Out of scope (0 real uses):** `@effect/sql`, `@effect/rpc`, `@effect/cluster`, `@effect/workflow`, `@effect/experimental`, `@effect/printer*` | 0                     | DB layer is **slonik** (custom port), untouched. Remove stale overrides.                                                                    | delete only                        |

**Package channel facts (verified on npm):** `effect@beta = 4.0.0-beta.94`; `@effect/platform-node@beta`, `@effect/vitest@beta`, `@effect/opentelemetry@beta` all share `4.0.0-beta.94`. `@effect/platform` and `@effect/cli` have **no** v4 beta — confirming they're absorbed into `effect/unstable/*`.

### 3.1 Phase-0 spike results (validated by `tsc` against `4.0.0-beta.94`)

The spike installed the pinned beta in an isolated sandbox and typechecked the **real `wallet` patterns** ported to v4. Every high-risk item passed (`tsc` exit 0). Net finding: **this migration is largely mechanical** — the scariest items (`Schema.brand` ×440, `Schema.Class`, `Struct`) are API-compatible.

- **`import * as X from "effect/X"` survives.** The `effect` `exports` map has `"./*": "./dist/*.js"`, so the codebase's deep-import style needs **no change** for stable modules. `import { X } from "effect"` is _not_ forced.
- **`Schema.brand` (440 sites): API-compatible.** `Schema.String.pipe(Schema.brand("WalletId"))` compiles unchanged. Biggest risk retired.
- **`Schema.Class` / `Struct` / `Literal` / `Union`: compatible.** `class X extends Schema.Class<X>("X")({...})` unchanged.
- **`Schema.TaggedError` → `Schema.TaggedErrorClass`: pure rename**, identical call shape `<Self>()("Tag", { fields })`. ⚠️ The wallet errors use a _redundant_ double-identifier form (`TaggedError<T>("Tag")("Tag", {...})`) — the codemod renames the symbol; the redundant arg is pre-existing and left alone (don't fold unrelated cleanup in — **Divergent Change**).
- **`Either` → `Result`, validated:** module is `effect/Result`; `Either.left`→`Result.fail`, `Either.right`→`Result.succeed`, `Either.match({onLeft,onRight})`→`Result.match({onFailure,onSuccess})`, `Either.Either<A,E>`→`Result.Result<A,E>`. `effect/Either` **does not exist** in v4.
- **`Result` name collision (NEW finding, `N4: Unambiguous Names`):** 4 domain roots (`wallet`, `organization`, `organization-roles`, `role`) define a **local `export type Result`** (the op's success payload: new state + events) _and_ import `Either`. Importing `effect/Result` as `Result` would shadow the local type. **Decision:** rename the domain-local payload type `Result` → **`Outcome`** in those files (clearer domain name for "resulting state + emitted events"; validated in the probe). Query-file local `Result` row-shapes that don't import `effect/Result` are left as-is.
- **`Context.Service`:** class form `class X extends Context.Service<X, Shape>()("Id") { static layer = Layer.succeed(X)(X.of({...})) }` — validated. `Context.Reference` replaces `FiberRef` (2 files).
- **HttpApi/HttpServer: pure path-swap** preserving `import * as`. Both deep (`effect/unstable/httpapi/HttpApi`) and barrel (`effect/unstable/httpapi`) resolve; codemod uses the **deep path** so `import * as HttpApi from "@effect/platform/HttpApi"` → `import * as HttpApi from "effect/unstable/httpapi/HttpApi"` (lowest-risk 1:1 line rewrite). `@effect/platform-node` stays its own package (bump to beta).
- **`@effect/vitest`:** `it`, `it.effect`, `it.layer` unchanged — test files need no test-harness rewrite, only the effect-module renames within them.
- **Otlp:** `effect/unstable/observability` exports `Otlp`, `OtlpTracer`, `OtlpExporter` — Phase-6 modernization target replacing `@effect/opentelemetry/NodeSdk`.
- **Schema fn renames (confirmed present):** `decodeUnknown`→`decodeUnknownEffect`, `decode`→`decodeEffect`, `annotations`→`annotate` (method + curried), `encodedSchema`→`toEncoded`, `typeSchema`→`toType`.
- **`Effect.fromEither` → `Effect.fromResult`** (codemod (a), verified).

### 3.2 HttpApi v4 recipe (redesign — hand-migrated, each pattern proven to compile)

The v4 HttpApi layer is a **redesign**, not renames. All patterns below were verified against `4.0.0-beta.94` and proven on real files (`CliOrganizationContract.ts`, `Policy.ts` compile clean).

- **Endpoint: fluent chain → options object.** Verbs are `get/post/put/patch/head/options` (no `del` — DELETE goes through `HttpApiEndpoint.make`). The mutating chain folds into a 3rd options arg:
  - `.addSuccess(S)` → `success: S`; `.setPayload(P)` → `payload: P`; `.setPath(P)` → `path: P`; `.setUrlParams(Q)` → `urlParams: Q`; `.setHeaders(H)` → `headers: H`.
  - **multiple `.addError(A).addError(B)` → `error: [A, B]`** (array).
  - `.prefix(...)`, `.annotate(...)` **stay chained** (still methods in v4).
  - `HttpApiEndpoint.get("n", "/p").addSuccess(S).addError(E)` → `HttpApiEndpoint.get("n", "/p", { success: S, error: E })`.
- **Group-wide `HttpApiGroup.addError(E)` is gone → distribute `E` onto every endpoint's `error`** in that group. `.middleware(...)`, `.prefix(...)`, `.add(...)` stay.
- **Middleware: `HttpApiMiddleware.Tag` → `HttpApiMiddleware.Service`**, and the config splits across the two call stages: `provides` moves into the **type-param** config; `failure` → **`error`** in the options object:
  ```ts
  // v3
  class M extends HttpApiMiddleware.Tag<M>()("M", { failure: Schema.Union(A, B), provides: X }) {}
  // v4
  class M extends HttpApiMiddleware.Service<M, { provides: X }>()("M", {
    error: Schema.Union([A, B]),
  }) {}
  ```
- **`Schema.Union(a, b)` → `Schema.Union([a, b])`** (array arg; 2 sites). **`Schema.Literal(a, b, …)` (multi) → `Schema.Literals([a, b, …])`** (6 sites). Single-arg `Schema.Literal(x)` unchanged.
- **`Schema.int` → `Schema.Int`** (semantic: filter → schema; 4 sites, manual).
- **`Effect.Service` → `Context.Service`** (8 sites, manual): `effect:` option → `make:`; drop `accessors: true` and consume via `yield* X`; build `static layer = Layer.effect(this, this.make)`. **`FiberRef` → `Context.Reference`** (2 sites, manual).
- **Unused-import sweep:** codemods can leave imports orphaned (e.g. `HttpApiSchema` after the `annotations` unwrap). Run `eslint --fix` per package to prune — do NOT hand-prune blindly.

### 3.3 Resume guide

State on branch `chore/effect-v4-migration` (uncommitted working tree):

1. **Deterministic mechanical base:** `bash scripts/codemods/run-all.sh` regenerates the entire codemod diff from HEAD (idempotent). Start here after any reset.
2. **Then per-package, in topological order**, apply §3.2 by hand and drive to green with `pnpm -F @org/<pkg> exec tsc -b tsconfig.json --force`, fixing file-by-file:
   `contracts` → `database` → `api-client` → `server` (platform/ddd first, then role→user→todos→billing→auth→organization) → `jobs`/`cli`/`mcp` → `web`/`components` → `acceptance`.
3. **Proven-clean so far:** `wallet.root.ts`, `CliOrganizationContract.ts`, `Policy.ts` (middleware). Contracts error count at last check: 179 → (Policy + CliOrganization fixed) → work remaining in `SchemaUtils.ts` (biggest), `OrganizationContract`, `AuthContract`, `UserContract`, `DomainApi`, others.
4. Only after a package is green, run its tests (the parity-enforced suite is the safety net).

### 3.4 Hardest file — `contracts/src/SchemaUtils.ts` (deep Schema-transform rewrite)

This custom combinator library uses v3's low-level Schema internals, all reshaped in v4. **Do it first among the remaining contracts** (others use its `Email`/`URLString`/`ArrayFromFallible`/etc.) and with `packages/effect/SCHEMA.md` open. Verified v4 replacements:
- **`Schema.Schema<A, I, R>` → `Schema.Codec<A, I, R>`.** In v4 `Schema.Schema<T>` takes **one** type arg (decoded type only); the full codec with encoded type + services is `Schema.Codec<T, E, RD, RE>`. Every 3-arg `Schema.Schema<A,I,R>` signature becomes `Schema.Codec<...>`.
- **`Schema.transform(from, to, { decode, encode, strict })` → `from.pipe(Schema.decodeTo(to, transformation))`** and **`Schema.transformOrFail` → `Schema.decodeTo`** with an effectful `SchemaTransformation`. New composition model — `decodeTo`/`encodeTo` + `effect/SchemaTransformation` objects (not the old positional `{decode, encode}`).
- **`effect/ParseResult` is gone.** Issue constructors (`ParseResult.Type`, `.Forbidden`), `ArrayFormatter`, `ParseIssue`, `ParseResult.try/fail/encode/decode` map onto **`effect/SchemaIssue`** + **`effect/SchemaTransformation`** + Result-returning parser APIs (`Schema.decodeResult`/`encodeResult`). Confirm exact names against those `.d.ts`.
- **`Schema.extend` → `Schema.extendTo`; `Schema.PropertySignature` type + `Schema.propertySignature`/`Schema.fromKey`** — verify against v4 (the property-signature API changed shape).
- **`decodingFallback` annotation** — confirm the v4 annotation key/shape (used by `NullOrFromFallible`/`ArrayFromFallible`).
- **`Hash.symbol`/`Equal.symbol` custom-equality `WithEquality`** — the `Partial<Record<symbol, unknown>>` indexing errors are TS strictness; may just need typed symbol indexing, not an API change.

After `SchemaUtils.ts`, the remaining contracts (`Auth`, `User`, `Organization`, `Billing`, `Todos`, `CliAuth`, `CliTodos`, `DomainApi`, `CliApi`) are the **already-proven §3.2 HttpApi recipe** applied repeatedly — consider a 5th codemod for the endpoint fluent→options-object collapse if doing it by hand proves too repetitive.

---

## 4. Phased plan

Each phase lists its **green gate** — the command that must pass before moving on. Within a phase, the TDD cadence is: touch one file → run that file's test/typecheck → green → next.

### Phase 0 — Spike & mapping (throwaway, timeboxed ~½ day)

Exploratory: pin the signatures the docs leave ambiguous **empirically**, because the beta moves and guessing is a **G26: Be Precise** violation waiting to happen.

1. Scratch branch; a throwaway package with `effect@4.0.0-beta.94`.
2. Probe and record exact signatures for the uncertain items: **`Result`** (`fail`/`succeed`/`match`/`mapError`), **`Schema.brand`** (440 sites — the single biggest risk), **`Schema.Class`** construction + `.annotate`, **`Context.Service`** `make` + `static layer`, **`HttpApiBuilder`** handler signature, **Otlp** layer wiring, **`@effect/vitest`** `it.effect`/`assert` under v4.
3. Read the canonical guides in `Effect-TS/effect-smol/migration/` (`services.md`, `schema.md`, `error-handling.md`, `v3-to-v4.md`, `fiberref.md`, `generators.md`) and `packages/effect/SCHEMA.md`.
4. **Deliverable:** the §3 table upgraded to exact before/after snippets; a written codemod spec. **Delete the spike** (TDD doc: spike, understand, delete, then build for real).

_Gate:_ mapping table reviewed; no code committed to the migration branch yet.

### Phase 1 — Dependency flip & codemod infrastructure

1. New branch `chore/effect-v4-migration` off `main`.
2. Rewrite `pnpm.overrides`: `effect → 4.0.0-beta.94`; bump `@effect/platform-node`, `@effect/vitest`, `@effect/opentelemetry` to `4.0.0-beta.94`; **delete** the absorbed/unused overrides (`@effect/platform`, `@effect/cli`, `@effect/rpc`, `@effect/cluster`, `@effect/sql`, `@effect/workflow`, `@effect/experimental`, `@effect/printer*`, `@effect/platform-browser`). Update each package.json's direct deps to match (remove `@effect/platform`, `@effect/cli`, `@effect/sql`; keep `slonik`, `pg`, `@effect/platform-node`).
3. `pnpm install`; commit the lockfile churn alone.
4. Author **codemod scripts** (`scripts/codemods/*.mjs`, `ts-morph`-based — AST, not blind sed, so `Context.Service` arg-flips and `Either`→`Result` constructor swaps are correct). Keep them in-repo, reviewable, and re-runnable. Split: (a) pure import-path/identifier renames, (b) `Context.Tag`→`Context.Service`, (c) `Either`→`Result`.
5. Run codemod (a) across all packages. **Commit as one isolated "mechanical rename" commit** so review can trust it as diff-noise and focus attention on (b)/(c) and the hand edits.

_Gate:_ codemods run without error; branch installs; mechanical diff committed separately. (Compilation still red — expected.)

### Phase 2 — Pilot vertical slice: `contracts` → `platform/ddd` → `wallet` → `api-client`/`web` (prove the mapping end-to-end)

This is the vertical slice that de-risks everything. `wallet` (20 files) carries the full stereotype set — root+test, errors, events, id, repository port + live/fake/mapper + integration test, event-handler + tests, event-adapter, module — so getting it green exercises Schema, `Result` domain ops, `Context.Service`, both event buses, and an integration test on one thin path.

Order (TDD, one file at a time, test after each):

1. **`@org/contracts`** compiles under v4 (Schema, `TaggedErrorClass`, `HttpApi` contract defs). `pnpm -F @org/contracts check` green, then **rebuild** it (web/api-client typecheck against the _built_ contracts — known gotcha).
2. **`platform/ddd/contracts` then `platform/ddd/ports`** (the shared kernel: `DomainEvent`, `UnitOfWork`, `CommandBus`, buses, `withUnitOfWork`) — `Context.Tag`→`Context.Service` lands here first because every module depends on it. Adjust each service's test first where the shape shifts.
3. **`wallet` domain**: `wallet.root.ts` ops `Either`→`Result` — **rewrite `wallet.root.test.ts` expectations first**, watch red, make green. Then `wallet.id.ts` (brand), `wallet.errors.ts` (`TaggedErrorClass`), `wallet.events.ts`.
4. **`wallet` repository**: port (`Context.Service`), `-live`/`-fake`/`-mapper`; run `wallet.repository-fake.test.ts` (unit) then defer the `-live.integration.test.ts` to the integration gate.
5. **`wallet` event-handler + event-adapter + module**; run their unit tests.
6. **`api-client` + one `web` consumption** of a wallet read, to prove the type boundary crosses the front end.

_Gate:_ `pnpm -F @org/server test -- wallet` (unit) green; `pnpm -F @org/contracts -F @org/api-client check` green. Mapping proven — **fan-out is now mechanical repetition of a known-good recipe.**

### Phase 3 — Fan out the rest of `server`, module by module

Order by dependency then size: **remaining `platform/`** (auth, ids, middlewares, notifications) → `role` (25) → `user` (38) → `todos` (51) → `billing` (57) → `auth` (106) → `organization` (145). Each module repeats the Phase-2 recipe (domain `Result` ops with test-first, `Context.Service`, `TaggedErrorClass`, HttpApi endpoints under `effect/unstable/httpapi`). Run the module's unit tests after each file; run the module's suite before advancing.

_Gate per module:_ that module's `*.test.ts` (unit) green. _Phase gate:_ `pnpm -F @org/server test` (full unit suite) green.

### Phase 4 — `database`, `jobs`, `cli`, `mcp`

- **`database`** (22 files): the slonik wrapper — mostly `Layer`/`Context.Service` + `Config` + `Redacted`. No Effect-SQL migration (we don't use it). Verify `PersistenceUnavailable`/`DatabaseError` demotion still holds.
- **`jobs`** (6), **`cli`** (11 — `@effect/cli` → `effect/unstable/cli`), **`mcp`** (1).

_Gate:_ `pnpm -F @org/jobs -F @org/cli -F @org/mcp check` + their unit tests green.

### Phase 5 — `web`, `components`, `acceptance`

- Rebuild `@org/contracts` first. **`web`** (51): the view-tiering rules mean little raw Effect in components; the churn is in `services/` (runtime, ApiClient) + `data-access/`. **`components`** (3). **`acceptance`**: Playwright drivers consume `api-client` — flip and run.

_Gate:_ `pnpm -F @org/web -F @org/components check`; `pnpm -F @org/components build-storybook`.

### Phase 6 — Modernization pass (the showcase deliverable)

Now that everything compiles green, adopt v4 idioms deliberately, each as its own reviewable commit, each guarded against smells:

- **`Effect.fn` named tracing** on use-case handlers, which adds a per-use-case span **inside** the bus/endpoint boundary span. This **supersedes ADR-0012** (which confined spans to the bus/endpoint boundary): write a new ADR that documents the shift to `Effect.fn`-per-use-case tracing, its rationale (richer traces now that v4 makes named spans first-class + cheap), and how it composes with the retained bus-boundary spans — then mark ADR-0012 superseded. This is a deliberate architectural change, reviewed on its own merits, **not** a blanket sprinkle: trace at use-case granularity, resist adding spans below that (still **G — Speculative Generality** territory).
- **`Context.Service` `make`/`static layer`** pattern applied uniformly (not just where compilation forced it).
- **`effect/unstable/observability` (Otlp)** replaces `@effect/opentelemetry/NodeSdk`; drop the `@effect/opentelemetry` dep. Verify traces still land in Jaeger via `pnpm bootstrap`.
- **`use` accessors** only where they read more clearly than `yield*` (the services guide prefers `yield*` for dependency legibility — don't over-apply).
- **Measure the tree-shaking win**: record `web` production bundle size before/after in the PR description — the concrete payoff.

_Gate:_ `pnpm check:all` green; bundle-size delta recorded.

### Phase 7 — Full verification, docs, cleanup

1. `pnpm check:all` (lint + lint:deps + check + unit tests + storybook) green.
2. `DATABASE_URL_TEST=… pnpm test:integration` green (recipe in memory). This is where the **wallet/query/repository `*.integration.test.ts`** and endpoint integration tests actually exercise real SQL under v4.
3. `pnpm test:acceptance` (Playwright).
4. **Run the app** (`pnpm bootstrap` + `dev`) — sign in via Zitadel BFF, exercise a real endpoint, confirm a trace in Jaeger. (Migration correctness isn't proven by types alone.)
5. **Docs:** new ADR — "Adopt Effect v4 (effect-smol)" — recording the unstable-module policy (`effect/unstable/*` may break on minor bumps), the **exact beta pin `4.0.0-beta.94`**, and the `Either`→`Result` idiom change. Plus the Phase-6 ADR superseding **ADR-0012** (use-case-level `Effect.fn` spans). Update **CLAUDE.md**: import paths, the `Result<_, DomainError>` domain idiom (was `Either`), `TaggedErrorClass`, `Context.Service`. Follow the memory'd ADR style (self-contained, no live source links).
6. Delete codemod scripts (or move to `scripts/archive/`), remove all dead overrides, grep for leftover `@effect/platform`/`Either`/`catchAll`/commented-out v3 code (**C5: Commented-Out Code** — none may remain).

_Gate:_ `pnpm check:all` + integration + acceptance all green; app verified live.

---

## 5. Code-smell watchpoints (from the catalog)

- **Shotgun Surgery / Duplication (G5):** the codemods _are_ the mitigation — never hand-edit 259 rename sites.
- **Speculative Generality (G):** the #1 risk of a "modernization" pass. No abstraction without a present call site.
- **Divergent Change:** keep migration commits pure — no drive-by refactors of unrelated logic.
- **Mysterious / Unambiguous Names (N4):** verify `effect/Result` doesn't collide with any domain type literally named `Result`; the CLAUDE.md `Result<_, DomainError>` is a _placeholder for the success value_, which reads fine, but confirm no actual `Result` symbol clash.
- **C2/C5 Obsolete & Commented-Out Code:** no `// v3:` corpses left behind; delete, don't comment.
- **G4 Overridden Safeties:** zero new `eslint-disable`/`@ts-expect-error`/`as any` to force compilation. If v4 types resist, fix the shape — a suppression here would also trip `/review-compliance`.
- **T1/T3 Test coverage:** parity rules (`pnpm lint`) already enforce sibling tests; don't delete a test to dodge a red — fix it.

---

## 6. Risks & rollback

- **Beta churn:** pin `4.0.0-beta.94` exactly (not `beta`) for reproducibility; a bump is a deliberate, separate change.
- **`Schema.brand` (440 sites):** ~~biggest unknown~~ **RESOLVED by the Phase-0 spike — API-compatible, zero changes.** The migration is confirmed largely mechanical.
- **`effect/unstable/*` instability:** `httpapi`/`http`/`cli` can break on minor beta bumps — documented in the new ADR; the pinned version protects us until we choose to bump.
- **Rollback:** the whole effort is one branch; abandoning it reverts to `main` cleanly. Per-phase gates mean we always know the last-green point.

## 7. Definition of done

- [ ] `pnpm check:all` green on the branch.
- [ ] `pnpm test:integration` (real DB) green.
- [ ] `pnpm test:acceptance` green.
- [ ] App runs; sign-in + one endpoint + Jaeger trace verified live.
- [ ] No `@effect/platform`/`@effect/cli`/`Either`/`catchAll`/commented v3 code remains; overrides cleaned.
- [ ] ADR added; CLAUDE.md updated.
- [ ] Web bundle-size delta recorded in the PR.
