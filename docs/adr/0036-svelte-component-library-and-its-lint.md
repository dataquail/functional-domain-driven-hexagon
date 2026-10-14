# ADR-0036: The Svelte component library and how its rules reach `.svelte`

- Status: Accepted
- Date: 2026-10-11
- Amends: ADR-0015 (the component library grows a Svelte twin, `@org/components-svelte`), ADR-0025 (oxlint is no longer the only linter), ADR-0029 (the engine reads Svelte components).

## Context and Problem Statement

The Cloudflare migration rewrites the web app in SvelteKit (Phase 6). Phase 5 ports the component library first, to `packages/components-svelte`, beside the React one until the cutover. ADR-0015's rules have to hold in the new package from its first component:

- no raw intrinsics in a pattern or a screen;
- no `class` or `style` handed to a component;
- closed-union props mapped through literal class tables;
- strictly controlled `Input`, `Checkbox` and `Select`;
- only `primitives/` may name a third-party visual library.

Today those rules are enforced by oxlint (`react/forbid-elements`, `local/no-inline-styling`) and by the architecture policy. Neither was written for `.svelte` files:

- oxlint 1.81 lints a component's `<script>` blocks and hands them to JS plugins, so `architecture/imports` and `architecture/structure` do fire on them. It does not parse the markup, so the JSX rules have nothing to see.
- The goodbones CLI walked only `.ts`, `.tsx`, `.mts` and `.cts`. The graph rules, the coverage floors and the conformance ceilings never saw a component. An allowance used only from one counted as slack, and a helper only a component imported read as an orphan.
- Type-aware oxlint does not know Svelte's module format. A `.ts` file importing a named type from a `.svelte` module gets an error type.

## Decision

**Types first.** A component's props are a TypeScript type in its `<script module>`, with no `class`, `style` or rest spread. `svelte-check` joins `pnpm check`, so passing `class`, `style` or a value outside a union is a type error, the same guarantee the React primitives give. `Input`, `Checkbox`, `Select` and `Dialog` take their value and change handler as required props and bind them through function bindings. An `Input` edit its owner does not take is undone, and a test shows that.

**ESLint for the markup, scoped to `.svelte`.** `eslint-plugin-svelte` runs in `pnpm lint` (`lint:svelte`) beside oxlint, from a root `eslint.config.mjs` that selects `packages/**/*.svelte` only. In `components-svelte/patterns/` (stories excepted, as in React) it enforces:

- `svelte/no-restricted-html-elements`, with `react/forbid-elements`' element list and messages;
- `svelte/no-inline-styles`;
- `no-restricted-syntax` for a `class`, `className` or `style` attribute and a `class:` directive.

Each rule has a probe in `pnpm lint:rules`. oxlint keeps every other file and the script blocks. ESLint 10 is the root's own; web's ESLint 9 is untouched.

**The engine reads Svelte.** `@goodbones/typescript` (0.1.0-beta.17 on) walks `.svelte` files and parses their script blocks, with the markup blanked so offsets hold. The CLI and the plugin therefore agree on every family, and no floor or ceiling moved to make room for the new package. Two consequences:

- A members rule now states the prop contract where the CLI can check it: no `*Props` type in the package may declare `class`, `className` or `style`.
- That rule reaches every file in the package, so the coverage floors rose (structure 0.77, members 0.12, surface 0.92).

**Types a `.ts` file needs live in `.ts`.** The icon props and the toast helper are `.ts` modules, so the type-aware rules see them.

## Consequences

- Two linters run in `pnpm lint`, each over a disjoint concern of a `.svelte` file. A rule about markup is an ESLint rule with a `linter: "eslint"` probe.
- A package sitting beside one whose name it extends (`components` / `components-svelte`) exposed a taxonomy-root bug in goodbones core: the first root claimed every path sharing its prefix. Core 0.1.0-beta.17 keeps a root to its own folder, and the repo pins it.
- A compound primitive is a folder: the root `*.svelte`, its `*.part.svelte` parts (exempt from story parity, shown in the root's story) and an `index.ts` that hangs the parts on the root. Svelte has no `Object.assign`-on-a-function-component idiom of its own, and the CLI cannot probe a child key that refers back to its folder's name.
- Phase 6 extends `eslint.config.mjs` to `packages/web-svelte` and adds the ViewModel-boundary rule there. Its own frontend decisions take ADR-0037, and the later Phase 7 numbers shift by one.
