// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

/* eslint-disable */
import dataBoundaries from "@synapsestudios/eslint-plugin-data-boundaries";
import { fixupPluginRules } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import codegen from "eslint-plugin-codegen";
import _import from "eslint-plugin-import";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sortDestructureKeys from "eslint-plugin-sort-destructure-keys";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dumbRepositoryPorts from "./scripts/eslint-rules/dumb-repository-ports.mjs";
import enforceReactNamespace from "./scripts/eslint-rules/enforce-react-namespace.mjs";
import noDeepRelativeImports from "./scripts/eslint-rules/no-deep-relative-imports.mjs";
import noEffectNamespaceImports from "./scripts/eslint-rules/no-effect-namespace-imports.mjs";
import noRelativeImportOutsidePackage from "./scripts/eslint-rules/no-relative-import-outside-package.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "**/dist",
      "**/build",
      "**/docs",
      "**/*.md",
      "**/vitest.config.ts",
      "**/setupTests.ts",
      "**/vitest.shared.ts",
      "**/vitest.workspace.ts",
      "reference/**",
      "scratchpad/**",
      "scripts/check-test-parity.mjs",
      "**/routeTree.gen.ts",
      // Next.js dev bundle output. Source lives under packages/web/{app,services,lib}.
      "**/.next/**",
      // PostCSS config — trivial config artifact outside any TS project service.
      "**/postcss.config.mjs",
    ],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ),
  {
    plugins: {
      import: fixupPluginRules(_import),
      "react-refresh": reactRefresh,
      "sort-destructure-keys": sortDestructureKeys,
      codegen,
      "simple-import-sort": simpleImportSort,
      react,
      "react-hooks": reactHooks,

      "no-relative-import-outside-package": {
        rules: {
          "no-relative-import-outside-package": noRelativeImportOutsidePackage,
        },
      },

      "no-effect-namespace-imports": {
        rules: {
          "no-effect-namespace-imports": noEffectNamespaceImports,
        },
      },

      "enforce-react-namespace": {
        rules: {
          "enforce-react-namespace": enforceReactNamespace,
        },
      },

      "no-deep-relative-imports": {
        rules: {
          "no-deep-relative-imports": noDeepRelativeImports,
        },
      },

      "dumb-repository-ports": {
        rules: {
          "dumb-repository-ports": dumbRepositoryPorts,
        },
      },
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        projectService: {
          allowDefaultProject: [
            "*.js",
            "*.mjs",
            "scripts/*.mjs",
            "scripts/eslint-rules/*.mjs",
            "packages/*/.storybook/*.ts",
          ],
        },
        tsconfigRootDir: process.cwd(),
      },
    },

    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },

      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      react: {
        version: "detect",
      },
    },

    rules: {
      "codegen/codegen": "error",
      "no-fallthrough": "off",
      "no-irregular-whitespace": "off",
      "object-shorthand": "error",
      "prefer-destructuring": "off",
      "sort-imports": "off",
      "no-console": "error",

      "no-relative-import-outside-package/no-relative-import-outside-package": "error",
      "no-effect-namespace-imports/no-effect-namespace-imports": "error",

      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='push'] > SpreadElement.arguments",
          message: "Do not use spread arguments in Array.push",
        },
        {
          selector: "ExportDefaultDeclaration",
          message: "Prefer named exports",
        },
        {
          selector:
            "ImportDeclaration[source.value='lucide-react'] ImportSpecifier > Identifier[name!=/Icon$/]",
          message: "Lucide imports must end with 'Icon' (e.g., 'ClockIcon' instead of 'Clock')",
        },
      ],

      "prefer-rest-params": "off",
      "prefer-spread": "off",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-unresolved": "off",
      "import/order": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "sort-destructure-keys/sort-destructure-keys": "error",

      "@typescript-eslint/array-type": [
        "warn",
        {
          default: "generic",
          readonly: "generic",
        },
      ],

      "@typescript-eslint/member-delimiter-style": 0,
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
      ],

      // TypeScript - Variables & Usage
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          vars: "all",
          args: "all",
          varsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",
      "no-var": "error",

      // TypeScript - Code Quality
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-empty-interface": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error",

      // TypeScript - Promises & Async
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      "@typescript-eslint/return-await": "error",

      // TypeScript - Types & Interfaces
      "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
          overrides: {
            accessors: "off",
            constructors: "no-public",
            methods: "explicit",
            properties: "explicit",
            parameterProperties: "explicit",
          },
        },
      ],
      "@typescript-eslint/consistent-generic-constructors": "error",

      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-confusing-non-null-assertion": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowNullableEnum: false,
          allowAny: false,
          allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false,
        },
      ],
      "no-dupe-else-if": "error",
      "no-dupe-keys": "error",
      "no-else-return": "error",
      "no-unreachable": "error",
      "no-use-before-define": "warn",
      "dot-notation": "error",
      eqeqeq: "error",
      "no-lonely-if": "error",
      "no-return-await": "error",
      "no-useless-catch": "error",
      "consistent-return": "warn",
      "no-unneeded-ternary": "error",
      "no-plusplus": [
        "error",
        {
          allowForLoopAfterthoughts: true,
        },
      ],
      "no-implicit-coercion": "error",
      "no-shadow": "warn",
      "no-self-compare": "error",

      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/camelcase": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/no-array-constructor": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-namespace": "off",
    },
  },
  {
    files: ["packages/web/**/*.{ts,tsx,js,jsx}", "packages/components/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "react/function-component-definition": [
        "warn",
        {
          namedComponents: ["arrow-function"],
          unnamedComponents: "arrow-function",
        },
      ],
      "react/display-name": "error",
      "react/jsx-key": "error",
      "react/jsx-no-comment-textnodes": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-target-blank": "error",
      "react/jsx-no-useless-fragment": "warn",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/no-children-prop": "off",
      "react/no-danger-with-children": "error",
      "react/no-deprecated": "error",
      "react/no-direct-mutation-state": "error",
      "react/no-find-dom-node": "error",
      "react/no-is-mounted": "error",
      "react/no-render-return-value": "error",
      "react/no-string-refs": "error",
      "react/no-unescaped-entities": "error",
      "react/no-unknown-property": "error",
      "react/no-unsafe": "error",
      "react/require-render-return": "error",
      "react/prop-types": "off",
      "react/no-array-index-key": "warn",
      "react/no-unused-state": "error",
      "react/button-has-type": "error",
      "react/hook-use-state": "error",
      "react/jsx-fragments": ["error", "element"],
      "react/react-in-jsx-scope": "off",
      "react/jsx-curly-brace-presence": "error",
      "react/jsx-boolean-value": "error",
      "react/self-closing-comp": "error",
      "react/no-unstable-nested-components": "error",

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "enforce-react-namespace/enforce-react-namespace": "error",
      "no-deep-relative-imports/no-deep-relative-imports": "error",
    },
  },
  {
    // ADR-0015: features and patterns must consume the bespoke component library.
    // Forbid raw HTML elements that already have a primitive equivalent.
    // The forbid-list grows as new primitives are added.
    files: ["packages/web/features/**/*.tsx", "packages/components/patterns/**/*.tsx"],
    ignores: ["**/*.test.tsx", "**/*.spec.tsx", "**/*.stories.tsx"],
    rules: {
      "react/forbid-elements": [
        "error",
        {
          forbid: [
            {
              element: "button",
              message: "Use <Button> from @org/components/primitives/button instead.",
            },
            {
              element: "input",
              message: "Use <Input> from @org/components/primitives/input instead.",
            },
            {
              element: "label",
              message: "Use <Label> from @org/components/primitives/label instead.",
            },
            {
              element: "select",
              message: "Use <Select> from @org/components/primitives/select instead.",
            },
            {
              element: "form",
              message: "Use <Form> from @org/components/primitives/form instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/server/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-deep-relative-imports/no-deep-relative-imports": "error",
    },
  },
  {
    // ADR-0024: repository ports are dumb persistence. The `*RepositoryShape`
    // type may only declare CRUD-shaped methods — domain verbs belong on the
    // aggregate. Constraining the port transitively keeps Live/Fake dumb,
    // since both must structurally satisfy it.
    files: ["packages/server/src/modules/**/domain/ports/repositories/*.repository.ts"],
    rules: {
      "dumb-repository-ports/dumb-repository-ports": "error",
    },
  },
  {
    // ADR-0021: each module owns its DB schema. App SQL must address its own
    // schema only ("user".users, todos.todos, etc). Cross-schema reads belong
    // in the synchronous event-bus seam, not in repository SQL.
    // The plugin uses `/modules/<name>/` to derive the schema for a given file.
    // test-utils/ is intentionally excluded — TRUNCATE in the test harness
    // legitimately crosses schemas to reset state between tests.
    files: ["packages/server/src/modules/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts", "**/*.test.tsx", "**/*.integration.test.ts"],
    plugins: {
      "@synapsestudios/data-boundaries": dataBoundaries,
    },
    rules: {
      "@synapsestudios/data-boundaries/no-cross-schema-slonik-access": [
        "error",
        { modulePath: "/modules/" },
      ],
    },
  },
  {
    files: ["packages/{domain,database}/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Playwright requires `export default` in playwright.config.ts and
    // globalSetup files. The "prefer named exports" project-wide rule
    // doesn't fit those framework hooks.
    files: ["packages/acceptance/{playwright.config,global-setup}.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  ...storybook.configs["flat/recommended"],
  {
    // ADR-0015: Storybook story and config files require `export default`. Loosen
    // project-wide restrictions that conflict with their conventions. These are
    // documentation/config artifacts, not production code.
    files: ["**/*.stories.tsx", "**/.storybook/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // ADR-0018: Next.js App Router requires `export default` in framework
    // convention files (page.tsx, layout.tsx, error.tsx, loading.tsx,
    // not-found.tsx, template.tsx, route.ts) and in next.config / middleware /
    // instrumentation. The project-wide "prefer named exports" rule doesn't
    // fit those framework hooks.
    files: [
      "packages/web/app/**/{page,layout,loading,error,not-found,template,route,default}.{ts,tsx}",
      "packages/web/next.config.ts",
      "packages/web/middleware.{ts,tsx}",
      "packages/web/instrumentation.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // ADR-0006 / ADR-0022: the type-safe Command/Query buses and the policy
    // infrastructure are extended by modules via TypeScript **declaration
    // merging**, which only works on `interface` (a merged `type` is a compile
    // error). `consistent-type-definitions` is a `--fix`-able warn that would
    // rewrite those `interface`s to `type` and silently break the merge, so it
    // is turned off for the registry seam files and every file that augments
    // them by convention. This is the Option-0 stopgap from
    // docs/scratch/typesafe-registry-declaration-merging-spike.md — it replaces
    // ~27 inline eslint-disable directives. The rule stays on everywhere else.
    files: [
      "packages/server/src/platform/ddd/ports/command-bus.ts",
      "packages/server/src/platform/ddd/ports/query-bus.ts",
      "packages/server/src/platform/auth/policy-registry.ts",
      "packages/server/src/platform/auth/resource-resolver-registry.ts",
      "packages/server/src/modules/**/*.command-handlers.ts",
      "packages/server/src/modules/**/*.query-handlers.ts",
      "packages/server/src/modules/**/queries/*.query.ts",
      "packages/server/src/modules/**/policies/*.policies.ts",
      "packages/server/src/modules/**/policies/*.resource-resolver*.ts",
      // Test seam that declaration-merges a synthetic `test` resource into the
      // policy registries (PolicyMap / ResourceResolverMap).
      "packages/server/src/platform/auth/authz.test.ts",
    ],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
    },
  },
  {
    // The four registry seams above are declared as intentionally-empty
    // `interface`s (the merge target). Turn off the empty-interface rules for
    // just those files so the empty declaration needs no inline disable.
    files: [
      "packages/server/src/platform/ddd/ports/command-bus.ts",
      "packages/server/src/platform/ddd/ports/query-bus.ts",
      "packages/server/src/platform/auth/policy-registry.ts",
      "packages/server/src/platform/auth/resource-resolver-registry.ts",
    ],
    rules: {
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];
