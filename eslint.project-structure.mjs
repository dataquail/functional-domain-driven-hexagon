// Declarative file taxonomy for the monorepo, enforced by
// `eslint-plugin-project-structure`'s `folder-structure` rule. This is the
// single source of truth for: allowed file stereotypes per folder (layout),
// required sibling files (parity — tests, fakes, stories), and the subfolder
// allowlists. It replaces the bespoke scripts/check-folder-layout.mjs and
// scripts/check-test-parity.mjs.
//
// The per-rule `message` fields (a fork feature — see vendor/README.md) are the
// didactic steering surface: a violation tells the author *what to do*, not just
// *that* a file is misplaced. Keep them instructive.
//
// Mechanics honored throughout (verified against the plugin):
//   - Deny-by-default: a folder that enumerates `children` rejects anything not
//     matched. This is the layout allowlist.
//   - File vs folder is by shape: a child rule WITH `children` matches folders,
//     WITHOUT matches files. A folder listing only folder-rules rejects all
//     direct files (our "container" folders).
//   - Tests are NOT auto-exempt: every folder holding tests must also admit its
//     test files (`{ name: "*.test.ts" }` matches both `.test.ts` and
//     `.integration.test.ts`).
//   - `enforceExistence` is append-only off `{node-name}` (the matched file's
//     name minus its final extension) and resolves `../` against the real FS.
//   - Specific rules take precedence over `*` catch-alls.

import { createFolderStructure } from "eslint-plugin-project-structure";

// ---------------------------------------------------------------------------
// Components (ADR-0015): every primitive/pattern component (`*.tsx`) needs a
// sibling Storybook story. Layout is intentionally permissive here (the scripts
// never enforced component-library layout) — only the story-parity fires.
// ---------------------------------------------------------------------------

const STORY_MESSAGE =
  " Every primitive/pattern component needs a sibling `*.stories.tsx` — the story is the component's living spec and visual test (ADR-0015). Add `<name>.stories.tsx` next to it.";

// A component folder's contents: story/test files pass through; every bare
// `*.tsx` component must have a sibling story; subfolders recurse (`ruleId`);
// any other file (index.ts, icons.ts) is permitted (layout stays permissive).
// The same shape applies at the structureRoot and at every nested folder.
const componentFolderChildren = [
  { name: "index.tsx" },
  { name: "*.stories.tsx" },
  { name: "*.test.tsx" },
  {
    name: "*.tsx",
    enforceExistence: "{node-name}.stories.tsx",
    message: STORY_MESSAGE,
  },
  { name: "*", ruleId: "dir" }, // recurse into any subfolder
  { name: "*" }, // permissive: allow any other file (e.g. index.ts, icons.ts)
];

const makeComponentsConfig = (structureRoot) =>
  createFolderStructure({
    structureRoot,
    rules: {
      dir: { name: "*", children: componentFolderChildren },
    },
    structure: componentFolderChildren,
  });

export const componentsPrimitives = makeComponentsConfig("packages/components/primitives");

export const componentsPatterns = makeComponentsConfig("packages/components/patterns");
