# Components

The bespoke component library. See [ADR-0015](../../../../docs/adr/0015-frontend-component-library.md) for the rationale.

**Two folders, three vocabulary tiers.** Folders enforce the encapsulation that matters mechanically; the atom/molecule/organism vocabulary lives in design conversation.

- `primitives/` — atoms. The only place that may import third-party visual libraries (`@radix-ui/*`, `lucide-react`, `recharts`, `sonner`).
- `patterns/` — molecules and organisms. Compositions of primitives (and other patterns).

`features/` consume both. The dependency direction is `features → patterns → primitives → third-party`, never reversed.

## Discovering what exists

**Storybook is the canonical index.** Every primitive and pattern has a sibling `*.stories.tsx` showing how it renders and what props it accepts.

```
pnpm -F @org/client storybook
# opens http://localhost:6006
```

Storybook surfaces the variant matrix (control panel), interactive states, light/dark theming, and a11y checks. The markdown table that used to live in this file became redundant — the stories are.

## Before reaching for a third-party library or building a new component

1. **Open Storybook.** If a primitive or pattern already does what you want, use it.
2. **If close-but-not-quite**, extend the existing component rather than fork.
3. **If genuinely missing**:
   - HTML primitive analog (button, input, badge, …) → add to `primitives/`.
   - Composition reused across features → add to `patterns/`.
   - Composition used by exactly one feature → keep it co-located with that feature; lift to `patterns/` when a second feature wants the same shape (the "would I copy this" rule).

## Patterns with state

When a pattern carries non-trivial state, ship it as a folder with its `*.view-model.ts` or `*.presenter.{ts,tsx}` co-located (per [ADR-0014](../../../../docs/adr/0014-frontend-view-layer-tiering.md)):

```
patterns/data-table/
  data-table.tsx
  data-table.stories.tsx
  data-table.view-model.ts
  data-table.view-model.test.ts
```

## Adding to the library

1. Create the component under `primitives/` or `patterns/`.
2. Write a sibling `*.stories.tsx`. The parity check (`pnpm lint:tests`) requires it.
3. Re-export from the relevant `index.ts` barrel.
4. (Pattern with state) write the parity test alongside, per ADR-0014.
5. (New raw HTML wrapper) add the underlying element to the `react/forbid-elements` list in `eslint.config.mjs` so feature code is steered to the new primitive.

## Icons

`primitives/icon/` exposes a `createIcon` factory and one wrapped export per icon used (`PlusIcon`, `TrashIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, …). Props are project-owned: `size` (`sm | md | lg`), `tone` (`default | muted | destructive | inherit`), `aria-label`, `aria-hidden` (defaults to `true`), `data-testid`. New icon: add a one-line `createIcon` export in `primitives/icon/icons.ts`. Never import `lucide-react` from outside `primitives/`.

## Enforcement

- `pnpm lint:deps` (`client-primitives-only-touch-ui-libs`) — third-party visual libs may only be imported from `primitives/`.
- `pnpm lint:deps` (`client-patterns-no-features`) — `patterns/` may not import `features/`.
- `pnpm lint` (`react/forbid-elements`, scoped to `features/` and `patterns/`) — bans raw `<button>`, `<input>`, `<label>`, `<select>`, `<form>` in favor of their primitive equivalents. Layout and text elements remain free. Update the forbid-list whenever a primitive replaces a raw element.
- `pnpm lint:tests` — every `primitives/**/*.tsx` and `patterns/**/*.tsx` requires a sibling `*.stories.tsx`.
- `pnpm build:storybook` (part of `pnpm check:all`) — broken stories fail CI.
- ADR-0014 dep-cruiser and parity rules apply unchanged to patterns that ship a view-model or presenter.
