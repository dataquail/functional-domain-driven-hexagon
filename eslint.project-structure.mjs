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
  "Every primitive/pattern component needs a sibling `*.stories.tsx` — the story is the component's living spec and visual test (ADR-0015). Add `<name>.stories.tsx` next to it.";

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

// ---------------------------------------------------------------------------
// Server modules (packages/server/src/modules/*) — the hexagonal/DDD taxonomy.
// Combines the layout allowlist (which file kinds a folder admits) with the
// sibling-parity rules (enforceExistence). Deny-by-default: any file/subfolder
// not matched below fails.
// ---------------------------------------------------------------------------

// Tests are NOT auto-exempt — every folder that holds tests must admit them.
// `*.test.ts` matches both `.test.ts` and `.integration.test.ts`.
const TEST_TS = { name: "*.test.ts" };

// Didactic messages (appended to the default violation text by the fork).
const MSG = {
  moduleRoot:
    "The module root admits only aggregation files: index.ts (barrel), <feature>.module.ts (composed Layer), <feature>.command-handlers.ts / .query-handlers.ts (bus-registration maps), <feature>.event-span-attributes.ts, <feature>.shared-deps.ts. Feature code belongs in a stereotype subfolder (domain/, commands/, queries/, event-handlers/, infrastructure/, interface/, policies/).",
  domain:
    "domain/ admits only named DDD stereotypes: *.root.ts (dumb data) + *.root-ops.ts (operations), *.aggregate.ts, *.entity.ts, *.value-object.ts + their *-ops.ts operation bags, *.id.ts, *.errors.ts, *.events.ts, *.specification.ts, *.domain-service.ts. A free-standing helper is a smell — model it as an aggregate op (*.root-ops.ts / *.entity-ops.ts / *.value-object-ops.ts), a named predicate (*.specification.ts), or (if it's stateless logic no aggregate owns) a *.domain-service.ts. A genuinely new *kind* of building block must be added to the taxonomy in eslint.project-structure.mjs — don't force-fit an existing stereotype.",
  rootOpsTest:
    "An aggregate root's operations bag (*.root-ops.ts) owns the invariants, so it carries the test-parity obligation: add the sibling *.root-ops.test.ts. (The *.root.ts data class is a dumb Schema and needs no test.)",
  specificationTest:
    "A specification (*.specification.ts) is a named domain predicate over an aggregate; add the sibling *.specification.test.ts.",
  constituentOpsTest:
    "A constituent operations bag (*.entity-ops.ts / *.aggregate-ops.ts / *.value-object-ops.ts) is domain-private invariant logic; add the sibling *.<stereotype>.test.ts.",
  domainServiceTest:
    "A domain service is real domain logic (ADR-0023), so it needs a sibling *.domain-service.test.ts.",
  repositoryPort:
    "Every repository port (*.repository.ts) needs its infrastructure trio: a *.repository-live.ts, a *.repository-fake.ts, and a *.repository-live.integration.test.ts in ../../../infrastructure/repositories/.",
  clientPort:
    "Every client port (*.client.ts) needs a *.client-live.ts, a *.client-fake.ts, and a *.client-live.test.ts in ../../../infrastructure/clients/. (A self-contained client with no port lives directly in infrastructure/clients/ as *.client.ts and is not required here.)",
  aclPort:
    "Every ACL port (*.acl.ts) needs a *.acl-live.ts, a *.acl-fake.ts, and a *.acl-live.test.ts in ../../../infrastructure/acl/.",
  commands:
    "commands/ holds a <verb-noun>.command.ts schema and its <verb-noun>.handler.ts handler. A shared helper here is a smell — domain logic belongs on an aggregate op (ADR-0023), trivial logic inlines.",
  commandHandlerTest:
    "Every command handler (*.handler.ts) needs a sibling *.handler.test.ts (use-case unit test with the repository fakes).",
  queries: " queries/ holds a <verb-noun>.query.ts schema and its <verb-noun>.handler.ts handler.",
  queryHandlerTest:
    "Every query handler (*.handler.ts) needs a sibling *.handler.integration.test.ts — queries read real SQL projections, so the parity is on the integration test (seed via the live repository).",
  eventHandlers:
    "event-handlers/ holds one *.handler.ts per reaction (triggers live in triggers/). Shared logic belongs on an aggregate or domain service.",
  eventHandlerTest: " Every event handler (*.handler.ts) needs a sibling *.handler.test.ts.",
  endpointTest:
    "Every endpoint (*.endpoint.ts) needs a real *.endpoint.integration.test.ts (ADR-0013) that exercises the HTTP layer against a live DB via useServerTestRuntime.",
  utilTest:
    "An interface *.util.ts is a pure leaf helper (ADR-0023); its sibling *.util.test.ts is the anti-drift guard — the extraction must be justified by a unit test.",
  eventAdapterTest:
    "Every event adapter (*.event-adapter.ts) needs a sibling *.event-adapter.test.ts (ADR-0007 ACL).",
  oidcExempt:
    "The OIDC flow endpoints (login/callback exchange with Zitadel, logout end-session) keep unit-token coverage: their happy path needs a live IdP and is covered by Playwright + the SessionRepositoryLive integration test. See CLAUDE.md 'Endpoint test naming'.",
  policies:
    "policies/ admits *.policies.ts registries, *.resource-resolver(s).ts, and is-*.policy.ts checks; policies/public/ holds *.service-live.ts (published ACL service Lives).",
};

// enforceExistence paths for a domain/ports/<tier>/ port, resolved 3 levels up
// to the sibling infrastructure/<bucket>/. Every entry is a pure append of the
// port's {node-name} (its filename minus the final extension), so our current
// -live/-fake/-test filenames are used unchanged.
const portCounterparts = (bucket, testSuffix) => [
  `../../../infrastructure/${bucket}/{node-name}-live.ts`,
  `../../../infrastructure/${bucket}/{node-name}-fake.ts`,
  `../../../infrastructure/${bucket}/{node-name}-live${testSuffix}`,
];

export const serverModules = createFolderStructure({
  structureRoot: "packages/server/src/modules",
  structure: [
    {
      name: "*", // each module
      // Deny-by-default message for a stray file/folder at the module root.
      message: MSG.moduleRoot,
      children: [
        // ── module root: aggregation files only ──
        { name: "index.ts" },
        { name: "*.module.ts" },
        { name: "*.command-handlers.ts" },
        { name: "*.query-handlers.ts" },
        { name: "*.event-span-attributes.ts" },
        { name: "*.shared-deps.ts" },

        // ── domain/ ──
        {
          name: "domain",
          message: MSG.domain, // stray file in domain/
          children: [
            // Aggregate root: dumb-data class (no test obligation) + its
            // operations bag (carries the parity). See ADR-0003.
            { name: "*.root.ts", message: MSG.domain },
            {
              name: "*.root-ops.ts",
              enforceExistence: "{node-name}.test.ts",
              message: MSG.rootOpsTest,
            },
            { name: "*.aggregate.ts", message: MSG.domain },
            {
              name: "*.aggregate-ops.ts",
              enforceExistence: "{node-name}.test.ts",
              message: MSG.constituentOpsTest,
            },
            { name: "*.entity.ts", message: MSG.domain },
            {
              name: "*.entity-ops.ts",
              enforceExistence: "{node-name}.test.ts",
              message: MSG.constituentOpsTest,
            },
            { name: "*.value-object.ts", message: MSG.domain },
            {
              name: "*.value-object-ops.ts",
              enforceExistence: "{node-name}.test.ts",
              message: MSG.constituentOpsTest,
            },
            { name: "*.id.ts", message: MSG.domain },
            { name: "*.errors.ts", message: MSG.domain },
            { name: "*.events.ts", message: MSG.domain },
            {
              name: "*.specification.ts",
              enforceExistence: "{node-name}.test.ts",
              message: MSG.specificationTest,
            },
            {
              name: "*.domain-service.ts",
              enforceExistence: "{node-name}.test.ts",
              message: MSG.domainServiceTest,
            },
            TEST_TS,
            {
              name: "value-objects",
              message: MSG.domain,
              children: [
                { name: "*.value-object.ts" },
                {
                  name: "*.value-object-ops.ts",
                  enforceExistence: "{node-name}.test.ts",
                  message: MSG.constituentOpsTest,
                },
                {
                  name: "*.specification.ts",
                  enforceExistence: "{node-name}.test.ts",
                  message: MSG.specificationTest,
                },
                TEST_TS,
              ],
            },
            {
              name: "ports", // container: tier subfolders only (no direct files)
              message: MSG.portsContainer,
              children: [
                {
                  name: "repositories",
                  message: MSG.repositoryPort,
                  children: [
                    {
                      name: "*.repository.ts",
                      enforceExistence: portCounterparts("repositories", ".integration.test.ts"),
                      message: MSG.repositoryPort,
                    },
                  ],
                },
                {
                  name: "clients",
                  message: MSG.clientPort,
                  children: [
                    {
                      name: "*.client.ts",
                      enforceExistence: portCounterparts("clients", ".test.ts"),
                      message: MSG.clientPort,
                    },
                  ],
                },
                {
                  name: "acl",
                  message: MSG.aclPort,
                  children: [
                    {
                      name: "*.acl.ts",
                      enforceExistence: portCounterparts("acl", ".test.ts"),
                      message: MSG.aclPort,
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ── commands/ & queries/ (schema + handler; pair rule intentionally
        //    dropped — see the migration ADR) ──
        {
          name: "commands",
          message: MSG.commands,
          children: [
            { name: "*.command.ts", message: MSG.commands },
            {
              name: "*.handler.ts",
              enforceExistence: "{node-name}.test.ts",
              message: MSG.commandHandlerTest,
            },
            TEST_TS,
          ],
        },
        {
          name: "queries",
          message: MSG.queries,
          children: [
            { name: "*.query.ts", message: MSG.queries },
            {
              name: "*.handler.ts",
              enforceExistence: "{node-name}.integration.test.ts",
              message: MSG.queryHandlerTest,
            },
            TEST_TS,
          ],
        },

        // ── infrastructure/ (container: adapter buckets only) ──
        {
          name: "infrastructure",
          message: MSG.infraContainer,
          children: [
            {
              name: "repositories",
              message: MSG.infraContainer,
              children: [
                { name: "*.repository-live.ts" },
                { name: "*.repository-fake.ts" },
                { name: "*.mapper.ts" },
                TEST_TS,
              ],
            },
            {
              name: "clients",
              message: MSG.infraContainer,
              children: [
                { name: "*.client-live.ts" },
                { name: "*.client-fake.ts" },
                { name: "*.client.ts" },
                { name: "*.email.tsx" },
                TEST_TS,
                { name: "*.test.tsx" },
              ],
            },
            {
              name: "acl",
              message: MSG.infraContainer,
              children: [{ name: "*.acl-live.ts" }, { name: "*.acl-fake.ts" }, TEST_TS],
            },
          ],
        },

        // ── interface/ (container: protocol subfolders only) ──
        {
          name: "interface",
          message: MSG.interfaceContainer,
          children: [
            {
              name: "http",
              message: MSG.interfaceContainer,
              children: [
                { name: "index.ts" },
                // OIDC flow endpoints keep their unit tokens (Playwright covers
                // the Zitadel round-trip); exempt from the integration-test rule.
                // Harmless in other modules — none name endpoints login/logout.
                { name: "login.endpoint.ts", message: MSG.oidcExempt },
                { name: "logout.endpoint.ts", message: MSG.oidcExempt },
                {
                  name: "*.endpoint.ts",
                  enforceExistence: "{node-name}.integration.test.ts",
                  message: MSG.endpointTest,
                },
                {
                  name: "*.util.ts",
                  enforceExistence: "{node-name}.test.ts",
                  message: MSG.utilTest,
                },
                TEST_TS,
              ],
            },
            {
              name: "cli",
              message: MSG.interfaceContainer,
              children: [
                { name: "index.ts" },
                {
                  name: "*.endpoint.ts",
                  enforceExistence: "{node-name}.integration.test.ts",
                  message: MSG.endpointTest,
                },
                {
                  name: "*.util.ts",
                  enforceExistence: "{node-name}.test.ts",
                  message: MSG.utilTest,
                },
                TEST_TS,
              ],
            },
            {
              name: "events",
              message: MSG.interfaceContainer,
              children: [
                {
                  name: "*.event-adapter.ts",
                  enforceExistence: "{node-name}.test.ts",
                  message: MSG.eventAdapterTest,
                },
                TEST_TS,
              ],
            },
          ],
        },

        // ── policies/ ──
        {
          name: "policies",
          message: MSG.policies,
          children: [
            { name: "*.policies.ts", message: MSG.policies },
            { name: "*.resource-resolver.ts", message: MSG.policies },
            { name: "*.resource-resolvers.ts", message: MSG.policies },
            { name: "*.policy.ts", message: MSG.policies },
            TEST_TS,
            {
              name: "public",
              message: MSG.policies,
              children: [{ name: "*.service-live.ts", message: MSG.policies }, TEST_TS],
            },
          ],
        },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Web features (packages/web/features) — view-tiering PARITY only (ADR-0014).
// Layout is intentionally permissive (the scripts never enforced web layout):
// every ViewModel and Presenter needs its sibling test; any other file is
// allowed. Self-recursive `dir` so parity fires at any nesting depth.
// ---------------------------------------------------------------------------

const VIEW_MODEL_MSG =
  "Every *.view-model.ts needs a sibling *.view-model.test.ts (ADR-0014 view tiering — the ViewModel is pure Effect and must be unit-tested).";
const PRESENTER_MSG =
  "Every *.presenter.{ts,tsx} needs a sibling *.presenter.test.tsx (ADR-0014 — the presenter binds a React-coupled library and is tested through a JSX wrapper).";

// One folder's contents; the same shape applies at the structureRoot and every
// nested folder. Parity rules first, then recurse into subfolders, then a
// permissive catch-all for any other file (no layout enforcement).
const webFeatureFolderChildren = [
  {
    name: "*.view-model.ts",
    enforceExistence: "{node-name}.test.ts",
    message: VIEW_MODEL_MSG,
  },
  {
    name: "*.presenter.ts",
    enforceExistence: "{node-name}.test.tsx",
    message: PRESENTER_MSG,
  },
  {
    name: "*.presenter.tsx",
    enforceExistence: "{node-name}.test.tsx",
    message: PRESENTER_MSG,
  },
  { name: "*", ruleId: "dir" }, // recurse into any subfolder
  { name: "*" }, // permissive: allow any other file
];

export const webFeatures = createFolderStructure({
  structureRoot: "packages/web/features",
  rules: {
    dir: { name: "*", children: webFeatureFolderChildren },
  },
  structure: webFeatureFolderChildren,
});

// ---------------------------------------------------------------------------
// Web TanStack-query bridge (packages/web/lib/tanstack-query) — every
// non-barrel source file bridges two runtimes and needs a sibling test; the
// test extension mirrors the source (.ts→.test.ts, .tsx→.test.tsx). The barrel
// (index.ts) and server-hydration-boundary.tsx are exempt.
// ---------------------------------------------------------------------------

const BRIDGE_MSG =
  "Every tanstack-query bridge file needs a sibling test (it carries branch logic invisible to presenter tests: toast surfacing, defect extraction, RSC/CC JSON round-trip, ParseError formatting).";

export const webTanstackBridge = createFolderStructure({
  structureRoot: "packages/web/lib/tanstack-query",
  structure: [
    { name: "index.ts" },
    { name: "server-hydration-boundary.tsx" },
    { name: "*.test.ts" },
    { name: "*.test.tsx" },
    { name: "*.ts", enforceExistence: "{node-name}.test.ts", message: BRIDGE_MSG },
    { name: "*.tsx", enforceExistence: "{node-name}.test.tsx", message: BRIDGE_MSG },
  ],
});
