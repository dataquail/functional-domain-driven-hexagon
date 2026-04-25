/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-domain-to-server",
      comment: "packages/contracts must not depend on packages/server",
      severity: "error",
      from: { path: "^packages/contracts/src/" },
      to: { path: "^packages/server/" },
    },
    {
      name: "no-domain-to-database",
      comment: "packages/contracts must not depend on packages/database",
      severity: "error",
      from: { path: "^packages/contracts/src/" },
      to: { path: "^packages/database/" },
    },
    {
      name: "module-user-barrel-only",
      severity: "error",
      comment:
        "Files outside the user module must import it via packages/server/src/modules/user/index.ts",
      from: { pathNot: "^packages/server/src/modules/user/" },
      to: {
        path: "^packages/server/src/modules/user/",
        pathNot: "^packages/server/src/modules/user/index\\.ts$",
      },
    },
    {
      name: "module-wallet-barrel-only",
      severity: "error",
      comment:
        "Files outside the wallet module must import it via packages/server/src/modules/wallet/index.ts",
      from: { pathNot: "^packages/server/src/modules/wallet/" },
      to: {
        path: "^packages/server/src/modules/wallet/",
        pathNot: "^packages/server/src/modules/wallet/index\\.ts$",
      },
    },
    {
      name: "module-todos-barrel-only",
      severity: "error",
      comment:
        "Files outside the todos module must import it via packages/server/src/public/todos/index.ts",
      from: { pathNot: "^packages/server/src/public/todos/" },
      to: {
        path: "^packages/server/src/public/todos/",
        pathNot: "^packages/server/src/public/todos/index\\.ts$",
      },
    },
    {
      name: "module-sse-barrel-only",
      severity: "error",
      comment:
        "Files outside the sse module must import it via packages/server/src/public/sse/index.ts",
      from: { pathNot: "^packages/server/src/public/sse/" },
      to: {
        path: "^packages/server/src/public/sse/",
        pathNot: "^packages/server/src/public/sse/index\\.ts$",
      },
    },
    {
      name: "domain-isolation",
      severity: "error",
      comment:
        "Module domain may only import from its own folder, effect (external), and the platform shared kernel (`domain-event.ts` for the event factory; `span-attributable.ts` for the cross-cutting `SpanAttributesExtractor` type used by event extractor signatures). No contracts, no cross-module, no infrastructure/application/interface.",
      from: { path: "^packages/server/src/modules/[^/]+/domain/" },
      to: {
        path: "^packages/",
        pathNot:
          "/domain/|^packages/server/src/platform/domain-event\\.ts$|^packages/server/src/platform/span-attributable\\.ts$",
      },
    },
    {
      name: "domain-no-external-beyond-effect",
      severity: "error",
      comment:
        "Module domain may only use 'effect' as an external dependency. No drizzle, no pg, no HTTP framework — keep the domain runtime-pure.",
      from: { path: "^packages/server/src/modules/[^/]+/domain/" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-peer", "npm-optional"],
        pathNot: "/node_modules/effect/",
      },
    },
    {
      name: "no-domain-to-application",
      severity: "error",
      comment: "Module domain layer must not depend on its application layer",
      from: { path: "^packages/server/src/modules/[^/]+/domain/" },
      to: { path: "^packages/server/src/modules/[^/]+/application/" },
    },
    {
      name: "no-domain-to-infrastructure",
      severity: "error",
      comment: "Module domain layer must not depend on its infrastructure layer",
      from: { path: "^packages/server/src/modules/[^/]+/domain/" },
      to: { path: "^packages/server/src/modules/[^/]+/infrastructure/" },
    },
    {
      name: "no-domain-to-interface",
      severity: "error",
      comment: "Module domain layer must not depend on its interface layer",
      from: { path: "^packages/server/src/modules/[^/]+/domain/" },
      to: { path: "^packages/server/src/modules/[^/]+/interface/" },
    },
    {
      name: "no-application-to-interface",
      severity: "error",
      comment: "Module application layer must not depend on its interface layer",
      from: { path: "^packages/server/src/modules/[^/]+/application/" },
      to: { path: "^packages/server/src/modules/[^/]+/interface/" },
    },
    {
      name: "no-application-to-infrastructure",
      severity: "error",
      comment:
        "Module application layer must not depend on its infrastructure layer (test files excluded — fakes are a test concern)",
      from: {
        path: "^packages/server/src/modules/[^/]+/application/",
        pathNot: "\\.test\\.ts$",
      },
      to: { path: "^packages/server/src/modules/[^/]+/infrastructure/" },
    },
    {
      name: "no-infrastructure-to-interface",
      severity: "error",
      comment: "Module infrastructure layer must not depend on its interface layer",
      from: { path: "^packages/server/src/modules/[^/]+/infrastructure/" },
      to: { path: "^packages/server/src/modules/[^/]+/interface/" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment:
        "This dependency is part of a circular relationship. You might want to revise " +
        "your solution (i.e. use dependency inversion, make sure the modules have a single responsibility) ",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-spec",
      comment:
        "This module depends on a spec (test) file. The sole responsibility of a spec file is to test code.",
      severity: "error",
      from: {},
      to: { path: "\\.(spec|test)\\.(js|mjs|cjs|ts|tsx)$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["main", "types"],
    },
    reporterOptions: {
      archi: {
        collapsePattern: "^(packages|src|lib|app|bin|test(s?)|spec(s?))/[^/]+|node_modules/[^/]+",
      },
      text: { highlightFocused: true },
    },
  },
};
