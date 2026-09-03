// Part of the architecture policy. The root manifest at architecture.config.mjs
// composes this with the other areas; everything here is written against
// repo-relative paths, so the patterns read the same wherever the file lives.

import { frontendTestFile, noDefaultExports } from "../architecture.mjs";

// The two MVVM tiers. Hoisted because a feature folder nests — the real shape
// is features/<area>/<feature>/ — and the rules hold at every depth.
const viewFile = {
  members: [
    {
      message:
        '`{name}` puts state or behaviour in the View, where it can only be tested through a renderer. A View\'s whole contract is "given these atom values, render this; on this interaction, write that" — move it to the sibling *.view-model.ts as an atom and read it here with useAtomValue/useAtomSet (ADR-0026).',
      subject: "calls",
      // Anything in `use*` position. The allowlist is the atom-React bindings
      // plus the two hooks that carry no state of their own: an SSR-safe unique
      // id, and a memo over a handler that already delegates.
      match: "use[A-Z]*",
      allow: [
        "useAtom",
        "useAtomValue",
        "useAtomSet",
        "useAtomSuspense",
        "useAtomRefresh",
        "useAtomSubscribe",
        "useAtomMount",
        "useAtomInitialValues",
        "useId",
        "useCallback",
      ],
    },
  ],
  imports: {
    reset: true,
    message:
      "A View depends on its ViewModel, and on nothing else (ADR-0026). It may not reach past it into services/ — not the API atoms, not the notification or navigation seams, not the runtime. Everything it renders or dispatches arrives as an atom its own ViewModel exposes; that is what lets the ViewModel be tested with no renderer and the View with no server.",
    external: ["effect", "@effect/atom-react", "react"],
    allow: ["~/web/features/{feature}/**", "~/components/**", "~/contracts/**"],
    deny: [
      {
        // Reaching for these means the logic belongs in the
        // ViewModel. Schema, Option, Result and friends are fine.
        match: [
          "**/effect/**/Effect.js",
          "**/effect/**/Stream.js",
          "**/effect/**/Fiber.js",
          "**/effect/**/Ref.js",
          "**/effect/**/SubscriptionRef.js",
          "**/effect/**/Layer.js",
          "**/effect/**/Scope.js",
          "**/effect/**/Runtime.js",
          "**/effect/**/ManagedRuntime.js",
          "**/effect/**/Cause.js",
          "**/effect/**/Exit.js",
          "**/effect/**/Match.js",
        ],
        message:
          "A View may not import Effect runtime primitives (ADR-0026). Reaching for Effect/Stream/Fiber/Ref/Layer/Scope/Runtime/Cause/Exit/Match means the logic belongs in the sibling *.view-model.ts. A View may still use Schema, Option, Result, Predicate, Duration, Array and the reactivity types it renders.",
      },
    ],
  },
};

const viewModelFile = {
  message:
    "Every *.view-model.ts needs a sibling *.view-model.test.ts (ADR-0026 — the ViewModel holds all of a feature's behaviour and runs under a bare AtomRegistry, so it is the tier that must be unit-tested).",
  requires: ["{base}.test.ts"],
  imports: {
    reset: true,
    message:
      "A ViewModel is framework-agnostic: it runs under a bare AtomRegistry in a test with no renderer anywhere (ADR-0026). It may not import react, react-dom, the atom React bindings, or a View — the arrow points View → ViewModel → Model and never back. A ViewModel that needs a hook is a View that has been misfiled.",
    external: ["effect"],
    allow: ["~/web/services/**", "~/web/features/{feature}/*.view-model.ts", "~/contracts/**"],
  },
};

export const webTree = {
  "~/web/": {
    name: "kebab-case",
    message:
      "packages/web is the Next App Router renderer: app/ holds the routes, features/ the MVVM tiers, services/ the Model, lib/ and test/ the supporting code. There is no fifth folder — a new one is a new tier.",
    surface: [
      // Next loads a route file and the config by their default exports.
      noDefaultExports(["~/web/app/**", "~/web/next.config.ts"]),
      {
        message:
          "No `export *` in web. A star re-export republishes every name of its target, so a barrel stops saying what it publishes. Re-export by name. The one exemption is the test fixtures barrel, a harness that exists to gather them.",
        kinds: ["namespace"],
        except: ["~/web/test/fixtures/index.ts"],
      },
    ],
    imports: {
      message:
        "packages/web consumes the component library and the shared contracts. It reaches a third-party visual library only through @org/components (ADR-0015), and there is no TanStack: state is Effect Atom (ADR-0026).",
      external: [
        "effect",
        "@effect/atom-react",
        "react",
        "react-dom",
        "next",
        "@vercel/otel",
        "server-only",
      ],
      allow: ["node:**", "~/web/**", "~/components/**", "~/contracts/**"],
    },
    children: {
      // Build configuration. Declared rather than left to fall through to the
      // taxonomy root, and narrow: a config file names the tool it configures.
      "instrumentation.ts | next.config.ts | vitest.config.ts | next-env.d.ts": {
        imports: {
          reset: true,
          message:
            "A build-configuration file names the tool it configures and nothing else — no features, no services, no components.",
          external: ["next", "vitest", "@vercel/otel"],
          allow: ["node:**"],
        },
      },

      // Framework surface: routes compose the Model directly (prefetch and the
      // hydration boundary), which is why the View restrictions stop here.
      "app/": {
        layout: "open",
        message:
          "app/ holds the Next file-based routes. It is framework surface: it composes the Model directly and keeps its intrinsics, so the View restrictions do not apply here.",
        children: { "**/": { layout: "open", children: {} } },
      },

      "features/": {
        message:
          "Files in packages/web/features/** must carry a view-tier stereotype (ADR-0026): a naked component is *.view.tsx, all behaviour is *.view-model.ts, and tests are *.test.{ts,tsx}. A bare component file has no stereotype — rename it *.view.tsx. There is no presenter tier.",
        children: {
          "{feature}/": {
            // __root holds the chrome every route shares — a slot in the
            // layout rather than a feature, and the one folder here that is
            // not named after one.
            name: {
              regex: "^(?:__root|[a-z0-9]+(?:-[a-z0-9]+)*)$",
              message:
                "A feature folder is kebab-case, named after the feature. The one exception is __root, the chrome every route shares.",
            },
            message:
              "Files in packages/web/features/** must carry a view-tier stereotype (ADR-0026): *.view.tsx, *.view-model.ts, or *.test.{ts,tsx}. There is no presenter tier.",
            children: {
              "*.view.tsx": viewFile,
              "*.view-model.ts": viewModelFile,
              "*.test.ts | *.test.tsx": frontendTestFile,
              "**/": {
                children: {
                  "*.view.tsx": viewFile,
                  "*.view-model.ts": viewModelFile,
                  "*.test.ts | *.test.tsx": frontendTestFile,
                },
              },
            },
          },
        },
      },

      "services/": {
        layout: "open",
        message:
          "services/ is the Model: the API atoms, the transport, the reactivity keys, the bridges and the formatters. It is the innermost tier and knows nothing about the features that read it.",
        imports: {
          reset: true,
          message:
            "The Model is the innermost tier (ADR-0026). A services/ file importing from features/ inverts the arrow and couples the API surface to a screen.",
          external: ["effect", "@effect/atom-react", "react", "react-dom", "next", "server-only"],
          allow: ["node:**", "~/web/services/**", "~/components/**", "~/contracts/**"],
        },
        children: {
          "*.test.ts | *.test.tsx": frontendTestFile,
          "**/": {
            layout: "open",
            children: { "*.test.ts | *.test.tsx": frontendTestFile },
          },
        },
      },

      "lib/": { layout: "open", children: {} },

      "test/": {
        layout: "open",
        message:
          "test/ holds the harnesses: the atom registry, the integration harness, MSW handlers and fixtures.",
        imports: {
          reset: true,
          message:
            "A web harness reaches the tier it stages, the component library and the contracts it serves. It never reaches the server.",
          external: [
            "effect",
            "@effect/atom-react",
            "react",
            "react-dom",
            "msw",
            "vitest",
            "@testing-library/react",
            "@testing-library/jest-dom",
            "@testing-library/user-event",
          ],
          allow: ["node:**", "~/web/**", "~/components/**", "~/contracts/**", "~/test-drivers/**"],
        },
        children: { "**/": { layout: "open", children: {} } },
      },
    },
  },

  // ── the process entrypoint ────────────────────────────────────────────
};
