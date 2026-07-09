# Effect v4 migration — web bundle-size delta

The concrete tree-shaking payoff of the `effect@3.21.2` → `effect@4.0.0-beta.94`
migration, measured on the `@org/web` production build (`next build`, Next.js 16 /
Turbopack).

**Method.** Sum of all client JS chunks under `packages/web/.next/static/chunks/*.js`,
raw and gzipped, from a clean production build on each branch:

```sh
find packages/web/.next/static/chunks -name "*.js" -exec cat {} + | wc -c            # raw
find packages/web/.next/static/chunks -name "*.js" -exec cat {} + | gzip -c | wc -c  # gzipped
```

| Branch                              | effect version  | Client JS (raw)        | Client JS (gzipped)   |
| ----------------------------------- | --------------- | ---------------------- | --------------------- |
| `main` (before)                     | `3.21.2`        | 1749.3 KB              | 510.1 KB              |
| `chore/effect-v4-migration` (after) | `4.0.0-beta.94` | 1407.0 KB              | 418.8 KB              |
| **delta**                           |                 | **−342.3 KB (−19.6%)** | **−91.3 KB (−17.9%)** |

The v3 baseline was produced from a clean `next build` in a `git worktree` checkout of
`main` (its own `pnpm install` pins `effect@3.21.2`), using the identical measurement.

> Note: the web bundle also carries React, Next, TanStack Query, Radix, Recharts, etc.,
> so the effect delta is only a fraction of the total. The bundle also still ships the
> browser OTEL SDK via `@effect/opentelemetry/WebSdk` (browser tracer port to the
> first-party exporter is a tracked follow-up), which dampens the delta on the web side
> specifically; the server-side dependency reduction (dropping `@effect/opentelemetry`
> and the `@opentelemetry/*` set) does not show up in this web measurement.
