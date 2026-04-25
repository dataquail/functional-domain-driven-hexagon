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
    tsConfig: { fileName: "tsconfig.json" },
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
