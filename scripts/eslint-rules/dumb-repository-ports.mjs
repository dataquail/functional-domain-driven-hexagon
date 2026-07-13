/* eslint-disable */
/**
 * @fileoverview Repository ports are dumb persistence with a minimal vocabulary
 * (ADR-0005). The `*RepositoryShape` type may only declare: the write verbs
 * `<insert|update|delete|upsert><One|Many>`, and the two reads `findOne` /
 * `findMany`. Reads take a `Specification` and nothing else — there are no
 * keyed or variant finders (`findOneById`, `findManyByOrganizationId`,
 * `findOneOpenBy…`, `findAll…`). Every lookup and every variant — by id, by a
 * natural key, "open", "active", "not deleted" — is a domain Specification the
 * caller composes and passes to `findOne`/`findMany`, so the rule lives in one
 * place, the fake filters and the live query with the same object, and the port
 * cannot drift into read-method bloat. Domain verbs (grant, revoke, promote,
 * activate, cancel, …) are aggregate behaviour, not persistence. Because the
 * Live and Fake implementations must structurally satisfy the port,
 * constraining the port's method names transitively keeps the implementations
 * dumb too.
 *
 * Scoped (via eslint.config.mjs) to:
 *   packages/server/src/modules/<m>/domain/ports/repositories/*.repository.ts
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

// A method name is allowed when it is exactly one of:
//   <verb><One|Many>  — insertOne, updateMany, deleteOne, upsertOne, …
//   findOne / findMany — the ONLY reads; each takes a Specification.
// A keyed or variant finder (findOneById, findManyByOrganizationId,
// findOneOpenBy…, findAll…) is rejected: express the lookup/variant as a
// Specification passed to findOne/findMany, not as a bespoke persistence method.
const ALLOWED_METHOD = /^(?:(?:insert|update|delete|upsert)(?:One|Many)|find(?:One|Many))$/;

function describeAllowed() {
  return "insertOne/insertMany, updateOne/updateMany, deleteOne/deleteMany, upsertOne/upsertMany, and findOne/findMany (each taking a Specification). Express a lookup or variant (by id, by email, open/active/not-deleted) as a Specification passed to findOne/findMany — not as a keyed/qualified find method.";
}

function keyName(member) {
  // Covers both `readonly save: (...) => ...` (TSPropertySignature) and
  // `save(...): ...` (TSMethodSignature). Computed keys (`[k]: ...`) are
  // skipped — a repository port never declares those.
  if (!member.key || member.computed) return null;
  if (member.key.type === "Identifier") return member.key.name;
  if (member.key.type === "Literal" && typeof member.key.value === "string") {
    return member.key.value;
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Repository ports may only declare CRUD-shaped methods; domain verbs belong on the aggregate (ADR-0005)",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },

  create: function (context) {
    function checkTypeLiteral(typeLiteral) {
      for (const member of typeLiteral.members) {
        if (member.type !== "TSPropertySignature" && member.type !== "TSMethodSignature") {
          continue;
        }
        const name = keyName(member);
        if (name === null) continue;
        if (ALLOWED_METHOD.test(name)) continue;

        context.report({
          node: member.key,
          message:
            `Repository port method "${name}" is not in the dumb-persistence vocabulary (ADR-0005). ` +
            (name.startsWith("find")
              ? `A read is only findOne/findMany taking a Specification — turn this lookup/variant into a Specification the caller composes (e.g. repo.findOne(XSpecifications.withId(id))). `
              : `It reads like a domain verb — put that behaviour on the aggregate and have the use case persist the result. `) +
            `Allowed: ${describeAllowed()}.`,
        });
      }
    }

    return {
      // Target the named `*Repository` / `*RepositoryShape` alias the Tag
      // is built from. Helper types in the same file are left alone.
      TSTypeAliasDeclaration(node) {
        if (!/Repository(Shape)?$/.test(node.id.name)) return;
        if (node.typeAnnotation && node.typeAnnotation.type === "TSTypeLiteral") {
          checkTypeLiteral(node.typeAnnotation);
        }
      },
    };
  },
};
