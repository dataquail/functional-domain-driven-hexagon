/* eslint-disable */
/**
 * @fileoverview Use-case DB access goes through `db.makeQuery`, never bare
 * `db.execute` (ADR-0007). `db.execute` runs on a fresh pool connection and
 * ignores any ambient unit-of-work transaction: a read dispatched inside a UoW
 * — e.g. a policy/ACL query resolved during a command's authorization — then
 * crashes with slonik's "Cannot run a query inside a transaction using a
 * foreign connection" (a 500) or silently reads pre-transaction state.
 * `db.makeQuery` checks for an ambient `TransactionContext` and reuses the
 * transaction's connection when one exists, falling back to the pool otherwise,
 * so the same handler is correct whether or not it is dispatched inside a UoW.
 *
 * Scoped (via eslint.config.mjs) to non-test files under:
 *   packages/server/src/modules/<m>/{commands,queries}/**
 * Test files keep bare `db.execute` for seeding (they run outside any UoW).
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Use-case reads must go through db.makeQuery (transaction-aware), not bare db.execute (ADR-0007)",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },

  create: function (context) {
    return {
      // Matches `db.execute(...)`. The DB service is bound as `const db =
      // yield* Database.Database` everywhere, so keying on the `db` receiver
      // keeps this from touching `queryBus.execute` / `commandBus.execute`.
      "CallExpression[callee.type='MemberExpression'][callee.object.name='db'][callee.property.name='execute']"(
        node,
      ) {
        context.report({
          node: node.callee.property,
          message:
            "Use `db.makeQuery((execute) => execute((client) => ...))` instead of `db.execute` in commands/ and queries/. " +
            "`db.execute` runs on a fresh pool connection and ignores the ambient unit-of-work transaction, so a read " +
            "dispatched inside a UoW (e.g. a policy/ACL query during command authorization) crashes with a foreign-connection " +
            "error or reads stale state. `db.makeQuery` joins the ambient transaction when one exists (ADR-0007).",
        });
      },
    };
  },
};
