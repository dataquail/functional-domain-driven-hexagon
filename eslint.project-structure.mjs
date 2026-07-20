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
    "domain/ is a container: it admits only subdomain folders (one per aggregate/consistency boundary), domain-services/ (cross-subdomain domain services), and ports/ (clients/ + acl/). No files live directly in domain/ — put the stereotype inside its subdomain folder.",
  subdomain:
    "A subdomain folder under domain/ admits its DDD stereotypes: *.root.ts (dumb data) + *.root-ops.ts, *.aggregate.ts / *.entity.ts / *.value-object.ts + their *-ops.ts bags, *.id.ts, *.errors.ts, *.events.ts, *.specification.ts, the subdomain's *.repository.ts port, and a value-objects/ subfolder. A free-standing helper is a smell — model it as an op or a *.specification.ts. Domain services do NOT live here (they span subdomains → domain/domain-services/); clients/acl ports live in domain/ports/.",
  domainServices:
    "domain/domain-services/ holds only *.domain-service.ts (+ its *.domain-service.test.ts): stateless domain logic that spans subdomains (ADR-0023), the one domain location allowed to compose more than one subdomain. Logic an aggregate owns belongs on that aggregate's *.root-ops.ts in its subdomain folder.",
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

// A repository port now lives inside its subdomain folder (domain/<sub>/),
// so its infrastructure trio resolves 2 levels up (not 3, as for the
// clients/acl ports still under domain/ports/<tier>/).
const subdomainRepoCounterparts = [
  "../../infrastructure/repositories/{node-name}-live.ts",
  "../../infrastructure/repositories/{node-name}-fake.ts",
  "../../infrastructure/repositories/{node-name}-live.integration.test.ts",
];

// The file kinds a subdomain folder (domain/<subdomain>/) admits: the DDD
// stereotypes for one aggregate, its repository port, and a nested
// value-objects/ folder. Domain services and clients/acl ports are NOT here.
const subdomainChildren = [
  { name: "*.root.ts", message: MSG.subdomain },
  { name: "*.root-ops.ts", enforceExistence: "{node-name}.test.ts", message: MSG.rootOpsTest },
  { name: "*.aggregate.ts", message: MSG.subdomain },
  {
    name: "*.aggregate-ops.ts",
    enforceExistence: "{node-name}.test.ts",
    message: MSG.constituentOpsTest,
  },
  { name: "*.entity.ts", message: MSG.subdomain },
  {
    name: "*.entity-ops.ts",
    enforceExistence: "{node-name}.test.ts",
    message: MSG.constituentOpsTest,
  },
  { name: "*.value-object.ts", message: MSG.subdomain },
  {
    name: "*.value-object-ops.ts",
    enforceExistence: "{node-name}.test.ts",
    message: MSG.constituentOpsTest,
  },
  { name: "*.id.ts", message: MSG.subdomain },
  { name: "*.errors.ts", message: MSG.subdomain },
  { name: "*.events.ts", message: MSG.subdomain },
  {
    name: "*.specification.ts",
    enforceExistence: "{node-name}.test.ts",
    message: MSG.specificationTest,
  },
  {
    name: "*.repository.ts",
    enforceExistence: subdomainRepoCounterparts,
    message: MSG.repositoryPort,
  },
  TEST_TS,
  {
    name: "value-objects",
    message: MSG.subdomain,
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
            // domain services: stateless logic spanning subdomains (ADR-0023),
            // the one domain location allowed to compose >1 subdomain.
            {
              name: "domain-services",
              message: MSG.domainServices,
              children: [
                {
                  name: "*.domain-service.ts",
                  enforceExistence: "{node-name}.test.ts",
                  message: MSG.domainServiceTest,
                },
                TEST_TS,
              ],
            },
            // ports container: clients + acl only. Repository ports live in
            // their subdomain folder (see the `*` subdomain rule below).
            {
              name: "ports",
              message: MSG.portsContainer,
              children: [
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
            // each subdomain folder (one per aggregate). Catch-all `*` — the
            // named domain-services/ and ports/ rules above take precedence.
            { name: "*", message: MSG.subdomain, children: subdomainChildren },
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
// Web features (packages/web/features) — view-tiering layout + parity (ADR-0014).
// Deny-by-default: a feature source file must carry one of the three view-tier
// stereotypes — *.view.tsx (naked component), *.presenter.{ts,tsx}, or
// *.view-model.ts. Tests are siblings, not stereotypes, so any *.test.{ts,tsx}
// (incl. *.integration.test.*) is admitted; every ViewModel/Presenter still owes
// its sibling test. Self-recursive `dir` so both fire at any nesting depth.
// ---------------------------------------------------------------------------

const VIEW_MODEL_MSG =
  "Every *.view-model.ts needs a sibling *.view-model.test.ts (ADR-0014 view tiering — the ViewModel is pure Effect and must be unit-tested).";
const PRESENTER_MSG =
  "Every *.presenter.{ts,tsx} needs a sibling *.presenter.test.tsx (ADR-0014 — the presenter binds a React-coupled library and is tested through a JSX wrapper).";
const VIEW_STEREOTYPE_MSG =
  "Files in packages/web/features/** must carry a view-tier stereotype (ADR-0014): a naked component is *.view.tsx, orchestration is *.presenter.{ts,tsx} or *.view-model.ts, and tests are *.test.{ts,tsx}. A bare component file has no stereotype — rename it *.view.tsx.";

// One folder's contents; the same shape applies at the structureRoot and every
// nested folder. Tests pass through first, then the three source stereotypes
// (with parity on presenter/view-model — views are dumb projection and carry
// none), then recurse into subfolders. No catch-all: deny-by-default.
const webFeatureFolderChildren = [
  { name: "*.test.ts", message: VIEW_STEREOTYPE_MSG }, // incl. *.integration.test.ts + *.view-model.test.ts
  { name: "*.test.tsx", message: VIEW_STEREOTYPE_MSG }, // incl. *.presenter.test.tsx + *.integration.test.tsx
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
  { name: "*.view.tsx", message: VIEW_STEREOTYPE_MSG },
  { name: "*", ruleId: "dir", message: VIEW_STEREOTYPE_MSG }, // recurse into any subfolder
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
