// Part of the architecture policy. The root manifest at architecture.config.mjs
// composes this with the other areas; everything here is written against
// repo-relative paths, so the patterns read the same wherever the file lives.

import { frontendTestFile, noDefaultExports } from "../architecture.mjs";

// A Storybook story: the component's living spec and visual test (ADR-0015). It
// names the component it documents and the Storybook runtime.
const storyFile = {
  imports: {
    reset: true,
    message:
      "A story names the component it documents, the component library around it and the Storybook runtime. Nothing from web, nothing from the server.",
    external: [
      "effect",
      "react",
      "react-dom",
      "storybook",
      "@storybook/react-vite",
      "@storybook/addon-themes",
      "sonner",
      "lucide-react",
    ],
    allow: ["node:**", "~/components/**"],
  },
};

export const componentsTree = {
  "~/components/": {
    name: "kebab-case",
    message:
      "@org/components holds two trees: primitives/ (atoms) and patterns/ (molecules and organisms), plus the class-name helpers in lib/, the providers/ and the Storybook config. A new folder here is a new tier — declare it deliberately.",
    // Storybook loads a story's meta and its own configuration by default export.
    surface: [noDefaultExports(["**/*.stories.tsx", "~/components/.storybook/**"])],
    imports: {
      message:
        "@org/components is a leaf workspace package: components are consumed by web, never the reverse. It may not import @org/web or anything under packages/web/.",
      external: ["effect", "react", "react-dom", "next", "clsx", "tailwind-merge"],
      allow: ["node:**", "~/components/**"],
    },
    children: {
      // The only tier allowed to name a third-party visual library, so the
      // prop surface of those libraries stops here.
      "primitives/": {
        layout: "open",
        message:
          "primitives/ wraps the third-party visual libraries so their prop surface is encapsulated. Every primitive is explicit props and closed unions mapped through literal class tables — no className, no DOM spread.",
        imports: {
          external: [
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "lucide-react",
            "recharts",
            "sonner",
          ],
        },
        children: {
          "*.tsx": {
            message:
              "Every primitive/pattern component needs a sibling *.stories.tsx — the story is the component's living spec and visual test (ADR-0015).",
            requires: ["{base}.stories.tsx"],
            requiresNot: ["index.tsx", "*.stories.tsx", "*.test.tsx"],
          },
          "*.stories.tsx": storyFile,
          "*.ts": {},
          "*.test.ts | *.test.tsx": frontendTestFile,
          "**/": {
            layout: "open",
            children: {
              "*.tsx": {
                requires: ["{base}.stories.tsx"],
                requiresNot: ["index.tsx", "*.stories.tsx", "*.test.tsx"],
              },
              "*.stories.tsx": storyFile,
              "*.ts": {},
              "*.test.ts | *.test.tsx": frontendTestFile,
            },
          },
        },
      },

      "patterns/": {
        layout: "open",
        message:
          "patterns/ composes primitives into molecules and organisms. It consumes the third-party libraries only through primitives/, and it never reaches into a feature.",
        imports: {
          reset: true,
          external: ["effect", "react"],
          allow: [
            "node:**",
            "~/components/primitives/**",
            "~/components/patterns/**",
            "~/components/lib/**",
          ],
        },
        children: {
          "*.tsx": {
            message:
              "Every primitive/pattern component needs a sibling *.stories.tsx — the story is the component's living spec and visual test (ADR-0015).",
            requires: ["{base}.stories.tsx"],
            requiresNot: ["index.tsx", "*.stories.tsx", "*.test.tsx"],
          },
          "*.stories.tsx": storyFile,
          "*.ts": {},
          "*.test.ts | *.test.tsx": frontendTestFile,
        },
      },

      "providers/": { layout: "open", children: { "*.tsx": {}, "*.ts": {} } },
      "lib/": { layout: "open", children: { "**/": { layout: "open", children: {} } } },
      ".storybook/": {
        layout: "open",
        imports: {
          reset: true,
          message:
            "The Storybook configuration names Storybook and the component tree it renders. Nothing else.",
          external: ["storybook", "@storybook/react-vite", "@storybook/addon-themes", "react"],
          allow: ["node:**", "~/components/**"],
        },
        children: {},
      },
    },
  },

  // ── packages/web ──────────────────────────────────────────────────────
  // Next renderer over the Effect BFF. MVVM, and the arrow points one way:
  // Model (services/) ← ViewModel (*.view-model.ts) ← View (*.view.tsx).
};
