# Rule: the Effect v4 source is the API reference

**Scope:** all code, all packages — read before writing Effect code against an API you are not certain of.

Effect v4 is a beta with no published API docs, and its module layout differs from v3. Recalling a v4 signature produces plausible-looking wrong code, so the upstream source is the reference — that is the Effect team's own guidance. A read-only checkout of `Effect-TS/effect` (v4 is its `main`) lives at `reference/effect`, gitignored, pinned to the tag matching the `effect` version in the root `package.json`.

```bash
pnpm effect:source              # clone, or fast-forward to the pinned tag
pnpm effect:source --ref main   # peek at unreleased upstream (does not change the pin)
pnpm effect:source --force      # discard the checkout and re-clone
```

If the directory is absent, run the script rather than answering from memory. Don't read `node_modules/effect` instead — it is built `.js`/`.d.ts` with no tests and no prose.

**Where to look**, under `reference/effect/`:

| Question                                   | Read                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| How do I write X idiomatically             | `LLMS.md`, then `ai-docs/src/<NN>_<topic>/` — numbered runnable `.ts` examples + `index.md` |
| Exact signature, overloads, variance       | `packages/effect/src/<Module>.ts`                                                           |
| Anything imported from `effect/unstable/*` | `packages/effect/src/unstable/<area>/` (`httpapi`, `http`, `sql`, `schema`, `cluster`, …)   |
| Real usage and edge-case semantics         | `packages/effect/test/<Module>.test.ts`                                                     |
| Area deep-dives                            | `packages/effect/{SCHEMA,HTTPAPI,CONFIG,MCP,OPTIC}.md`                                      |
| "this worked differently in v3"            | `MIGRATION.md`, `migration/<concept>.md`                                                    |
| Anti-patterns the maintainers call out     | `.patterns/effect.md`, `.patterns/testing.md`                                               |
| What changed between betas                 | `.changeset/`, `packages/effect/CHANGELOG.md`                                               |

- **Read-only reference, not a dependency.** Never import from it, add it to a tsconfig or the pnpm workspace, or copy a file out of it — take the idiom, not the file. It sits outside every package root, so `tsc -b`, vitest, dependency-cruiser and prettier never see it, and `reference/**` is a global eslint ignore. Keep it that way.
- **The checkout must match the pin.** A signature from a different beta is a wrong answer wearing the right shape. After bumping `effect` in the root `package.json`, re-run `pnpm effect:source`.
- **Keep it out of repo-wide searches.** Project-wide grep and glob stay under `packages/`; reach into the reference deliberately, with a `reference/effect/…` path prefix.
