/**
 * @fileoverview Constructing a bus takes the WHOLE routing table, so anything
 * that builds one could answer a message with a different module's handler than
 * the composed application would. Only a composition root may (ADR-0006). The
 * event bus, the unit of work and the unhandled-failure sink are fenced for a
 * related reason: a second instance of any of them is subscribers nobody
 * notifies, a transaction nobody joins, or reports nobody reads.
 *
 * This is a lint rule rather than a dependency-cruiser one because the
 * factories live in `@effect-server-utils/cqrs` and are re-exported from its
 * barrel: dep-cruiser matches resolved paths and every importer resolves to the
 * same barrel, so a path rule cannot tell the factories apart from the Tags that
 * everything legitimately imports. Matching the named import can.
 *
 * The library publishes each module as its own export subpath as well as through
 * the barrel, so the source test accepts both — a deep import is otherwise a
 * one-character way around this rule.
 *
 * The composition-root allowlist lives here rather than in lint config because
 * oxlint overrides have no `ignores`, and keeping it beside the restriction
 * makes the pair testable.
 */

import { isTestFile } from "./is-test-file.mjs";

const RESTRICTED_IMPORTS = new Set([
  "makeCommandBus",
  "makeQueryBus",
  "mergeDispatchTables",
  "makeEventBus",
  "makeUnitOfWork",
  "makeUnhandledFailures",
]);

const PACKAGE = "@effect-server-utils/cqrs";

const isPackageSource = (source) => source === PACKAGE || source.startsWith(`${PACKAGE}/`);

const COMPOSITION_ROOTS = [
  /packages\/server\/src\/server\.ts$/,
  /packages\/server\/src\/cqrs-runtime\.ts$/,
  /packages\/server\/src\/test-utils\//,
];

const isCompositionRoot = (filename) =>
  isTestFile(filename) || COMPOSITION_ROOTS.some((pattern) => pattern.test(filename));

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Bus/unit-of-work factories from @effect-server-utils/cqrs may only be called at a composition root (ADR-0006)",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },

  create: function (context) {
    if (isCompositionRoot(context.filename.replaceAll("\\", "/"))) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (!isPackageSource(node.source.value)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type !== "ImportSpecifier" ||
            !RESTRICTED_IMPORTS.has(specifier.imported.name)
          ) {
            continue;
          }

          context.report({
            node: specifier,
            message:
              `Building a CommandBus/QueryBus routes every module's messages, so '${specifier.imported.name}' ` +
              "belongs at a composition root (server.ts, cqrs-runtime.ts or test-utils/). Depend on the " +
              "`CommandBus`/`QueryBus` Tag instead, or — inside a module — publish that module's own surface " +
              "with `Command.dispatcher`. The event bus, the unit of work and the unhandled-failure sink are " +
              "fenced for a related reason: a second instance of any of them is subscribers nobody notifies, " +
              "a transaction nobody joins, or reports nobody reads.",
          });
        }
      },
    };
  },
};
