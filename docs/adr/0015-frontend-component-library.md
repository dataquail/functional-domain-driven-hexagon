# ADR-0015: Frontend component library — primitives, patterns, and the encapsulation of third-party UI

- Status: Accepted
- Date: 2026-04-29

## Context and Problem Statement

ADR-0014 carved the frontend into data-access ports, ViewModels, and Presenters, and enforced the layering with dependency-cruiser. It said nothing about the visual surface — what JSX a component is allowed to produce.

Without a rule there, two failure modes appear over time. First, every feature reaches for the third-party UI library directly: `@radix-ui/*` for primitives, `lucide-react` for icons, `recharts` for charts, `sonner` for toasts. The library's prop surface — including props the design system never wanted to expose — leaks into feature code. Swapping or upgrading the library means touching every feature. Second, slightly-richer compositions that ought to be reused (a filter pill, a confirm dialog, a paginated table) get re-implemented in each feature because there is no formalized place to put them and no vocabulary for promoting them. Both failures are well-attested in React codebases and both are invisible to ADR-0014's rules.

The forces:

- The application needs a stable visual vocabulary. Buttons, inputs, badges, and icons should look and behave the same everywhere, and changing how they look should be a one-file edit.
- The third-party UI library is an implementation detail. Its identity (today shadcn/Radix + lucide) and its prop surface are not contracts the application should depend on.
- Composite UI (filter bars, data tables, pagination, empty states) wants a home. Without one it gets re-implemented; with too many tiers it becomes a bikeshed.
- The rule must be machine-enforceable. ADR-0014 established that "review will catch it" decays; mechanical rules don't.
- The rule must accommodate the reality that some compositional UI carries state (sort, pagination, filter logic). ADR-0014 already provides ViewModels and Presenters for that — the component-library layer should plug into them, not duplicate them.

## Decision

Two folders in `packages/client/src/components/`, with the third-party encapsulation enforced at the folder boundary by dependency-cruiser.

### `components/primitives/` — atoms

The smallest visual units, each owning a single concern: `Button`, `Input`, `Label`, `Badge`, `Card`, `Dialog`, `DropdownMenu`, etc. Primitives are the **only** place in the codebase that may import third-party visual libraries (`@radix-ui/*`, `lucide-react`, `recharts`, `sonner`). They define the application's prop contract — variants, sizes, tones — and forward the constrained surface to the underlying library.

Class-name utilities (`clsx`, `tailwind-merge`, `class-variance-authority`) are not visual libraries and are not subject to the encapsulation rule; any layer may use them.

### `components/patterns/` — molecules and organisms

Compositions built from primitives (and other patterns) doing one focused job. The atomic-design vocabulary distinguishes molecules (small, single-job: `FormField`, `SearchInput`, `FilterPill`, `EmptyState`) from organisms (larger, often stateful: `DataTable`, `FilterBar`, `Pagination`, `AppHeader`). The vocabulary is useful for design conversation; the codebase does not need three folders to express it. Two tiers in folders, three in vocabulary.

A pattern that carries state plugs into ADR-0014's tiering: an organism with non-trivial logic ships as a folder containing the component, its `*.view-model.ts` or `*.presenter.{ts,tsx}`, and tests, co-located. The organism remains domain-agnostic; the consuming feature passes data and intents in.

Patterns may import primitives and other patterns. Patterns may not import third-party visual libraries directly; they go through primitives. Patterns may not import `features/`.

### `features/` consumes both

Feature components import primitives and patterns. They may not import third-party visual libraries. The dependency direction is `features → patterns → primitives → third-party`, never reversed, never skipping a step on the way out.

### Icons — a constrained-prop wrapper, not a re-export

Icons sit inside primitives (`components/primitives/icon/`). The wrapper exposes a project-owned `IconProps` (`size`, `tone`, `aria-label`, `aria-hidden`, `data-testid`) and forwards to lucide internally. Adding a new icon is one line via a `createIcon` factory; tree-shaking is preserved because each icon is its own export. `aria-hidden` defaults to `true`, so decorative use is the path of least resistance and labelled use is opt-in.

This is stricter than other primitives. `Button` and `Input` extend `React.ComponentProps<"button" | "input">`, which leaks the entire HTML element surface — but those interfaces are stable, well-known, and rarely surprising. Lucide is a third-party library with its own evolving API; the prop surface is worth constraining at the boundary. The asymmetry is intentional and not generalized to other primitives.

### Promotion path

A component starts where it is used. When a second feature wants the same shape, lift it to `components/patterns/`. The bar is "would I copy this," not "could this in principle be reused." Lifting is a mechanical move-and-rename; reverting it is the same in the other direction. The rule favors action over speculation.

### Discoverability

Storybook is the canonical index. Every primitive and pattern ships a sibling `*.stories.tsx` showing default rendering, variant matrix, light/dark theming, and interactive states. Run `pnpm -F @org/client storybook` to open it locally. A short markdown README at `components/README.md` keeps the rules of the road (folder layout, promotion path, icon contract) but defers the per-component catalog to Storybook itself.

CLAUDE.md points future agents at Storybook (and the README as a fallback), so the question "is there already a component for this?" is the cheap first check rather than a missed step.

### Enforcement

Per ADR-0008, layering is enforced by `pnpm lint:deps`. This ADR adds:

- `client-primitives-only-touch-ui-libs` — `@radix-ui/*`, `lucide-react`, `recharts`, and `sonner` may only be imported from `components/primitives/**`. Any other path fails CI. Test files exempted.
- `client-patterns-no-features` — `components/patterns/**` may not import `features/**`. The dependency is one-way.

ESLint (`pnpm lint`) adds:

- `react/forbid-elements` scoped to `features/**/*.tsx` and `patterns/**/*.tsx` — bans the raw HTML elements that have a primitive equivalent (`<button>`, `<input>`, `<label>`, `<select>`, `<form>`). Layout and text elements (`<div>`, `<span>`, `<section>`, headings, `<p>`, `<ul>`, `<li>`, `<a>`, `<img>`, `<textarea>`) remain free until they get a bespoke wrapper. The forbid-list grows when a new primitive is added; that growth is the design-system signal, not a maintenance burden — the moment a primitive replaces a raw element is also the moment to add the corresponding entry. Test and story files exempted.

Test parity (`pnpm lint:tests`) adds:

- Every `components/primitives/**/*.tsx` and `components/patterns/**/*.tsx` requires a sibling `*.stories.tsx`. The detector and the discoverability surface are the same artifact: if Storybook can't see it, neither can the next contributor.

CI gate (`pnpm check:all`) adds:

- `pnpm build:storybook` runs after the test suite. Broken stories — bad imports, type errors in story bodies, missing decorators — fail the build before merge. Storybook drift is mechanically prevented, not policed in review.

What is _not_ enforced: raw `<div>`/`<span>`/heading usage. Banning these is unworkable — layout containers and text legitimately need them. The rule covers the elements where the wrapper-vs-raw choice is mechanical; everything else is left to design judgment.

## Consequences

- **The third-party UI library is swappable.** Replacing shadcn/Radix or lucide is a `components/primitives/` edit. No feature code changes. The dep-cruiser rule guarantees there is no escape hatch.
- **Icon props are stable.** Features see `<TrashIcon size="md" tone="destructive" />`, never lucide's `strokeWidth` or `absoluteStrokeWidth`. Accessibility defaults to the right thing.
- **Compositions have a home.** "Where does this filter pill go?" has one answer. The atomic-design vocabulary stays alive in PR review without forcing a third folder.
- **Stateful organisms compose with ADR-0014.** A `DataTable` ships as `patterns/data-table/{data-table.tsx, data-table.view-model.ts, data-table.view-model.test.ts}`. The tiering and parity rules from ADR-0014 apply unchanged.
- **Adding an icon is friction by design.** A developer who needs a new icon must add a one-line wrapper. That friction is the moment the design system gets to confirm the icon is wanted; it is the moment an impatient agent might try to skip via a direct lucide import. The dep-cruiser rule catches the skip.
- **Migration cost is small but real.** `components/ui/` becomes `components/primitives/`; four feature files change their imports; three features lose their direct lucide imports in favor of the icon wrappers. `components.json` (shadcn config) updates aliases. One migration commit.
- **Raw HTML for primitive equivalents is lint-banned.** `react/forbid-elements` blocks `<button>`, `<input>`, `<label>`, `<select>`, `<form>` in `features/` and `patterns/`. The rule's catch rate scales with the library: every new primitive that replaces a raw element earns a one-line entry. Forgetting to update the list means losing future enforcement for that one element, not breaking anything; the cost is bounded.

## Alternatives considered

- **Three folders (atoms / molecules / organisms).** Cleanest mapping to the vocabulary. Rejected: the molecule-vs-organism boundary is famously fuzzy in practice and produces bikeshedding. Two folders capture the only boundary that matters mechanically (third-party encapsulation); the conversational distinction survives in naming.
- **Per-icon re-exports without wrappers** (`export { Trash } from "lucide-react"`). Cheaper, preserves tree-shaking, but leaks lucide's prop surface. Rejected: the whole point of the primitives layer is that the third-party prop API is not a contract.
- **Generic `<Icon name="trash" />` component.** Strongest encapsulation but loses tree-shaking and forces a name registry. Rejected: cost outweighs benefit at this scale.
- **Allowlist `lucide-react` everywhere.** The cheapest option. Rejected: it concedes the encapsulation goal entirely.
- **Constrain `Button` / `Input` props the same way as icons.** Generalizes the discipline. Rejected: HTML element interfaces are stable and well-known; the leak risk is qualitatively different from a third-party lib's evolving surface. Worth flagging as a known asymmetry, not worth fixing.
- **Skip the ESLint `react/forbid-elements` rule and rely on dep-cruiser plus review.** Considered: the dep-cruiser rule already blocks the most common path to skipping the library (importing Radix directly), and the lint rule's forbid-list has a maintenance cost. Rejected: the dep-cruiser rule does not catch raw `<button onClick={...}>` — and that gap was already exploited in the codebase (a raw `<label>` had snuck past `Label` in `todo-item.tsx`). The maintenance cost is one line per new primitive, paid at the moment the primitive is added. Worth it.
- **Markdown README as the canonical index.** Cheaper to set up — no extra build, no extra dependencies, no theming integration. Initially adopted; replaced by Storybook in a follow-up. The trigger was that even at ~15 primitives the table was awkward to read, the variant matrix wasn't visible, and there was no way to interactively try a component before importing it. The maintenance cost of a `*.stories.tsx` per component is bounded and partially self-enforcing (parity rule + CI build), so the tradeoff inverted.

## Related

- ADR-0008 (architecture enforcement via dependency-cruiser) — the mechanism extended here.
- ADR-0014 (frontend layering) — the tiering that organisms-with-state plug into.
