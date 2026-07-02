/* eslint-disable */
/**
 * @fileoverview Repository ports are dumb persistence with a cardinality-explicit
 * vocabulary (ADR-0024). The `*RepositoryShape` type may only declare methods of
 * the form <verb><One|Many>, where verb is insert/update/delete/upsert, plus
 * findOne / findMany (each optionally suffixed with a `By<Key>` lookup). Every
 * operation names its size — one row or many — so callers read intent off the
 * method name. Domain verbs (grant, revoke, promote, activate, cancel, …) are
 * aggregate behaviour, not persistence. Because the Live and Fake implementations
 * must structurally satisfy the port, constraining the port's method names
 * transitively keeps the implementations dumb too.
 *
 * Scoped (via eslint.config.mjs) to:
 *   packages/server/src/modules/<m>/domain/ports/repositories/*-repository.ts
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

// A method name is allowed when it is one of:
//   <verb><One|Many>                    — insertOne, updateMany, deleteOne, upsertOne, …
//   find<One|Many>[<Qualifier>]By<Key>  — findOneById, findManyByOrganizationId,
//                                          findOneOpenByOrganizationIdAndEmail, …
//   find<One|Many>                      — findOne, findMany (bare)
//   findAll[<Qualifier>]                — findAll, findAllActive (whole collection,
//                                          no key argument; qualifier is a built-in filter)
// On a keyed find the optional qualifier (e.g. "Open") is only permitted in front
// of the `By<Key>` clause, so it always rides along with a lookup — a bare
// find-and-mutate name like `findOneAndDelete` (no `By`) is still rejected. A
// keyless filtered collection is `findAll<Qualifier>`, not `findMany<Qualifier>`.
const ALLOWED_METHOD =
  /^(?:(?:insert|update|delete|upsert)(?:One|Many)|findAll(?:[A-Z][A-Za-z0-9]*)?|find(?:One|Many)(?:(?:[A-Z][A-Za-z0-9]*)?By[A-Z][A-Za-z0-9]*)?)$/;

function describeAllowed() {
  return "insertOne/insertMany, updateOne/updateMany, deleteOne/deleteMany, upsertOne/upsertMany, findOne/findMany (optionally find{One,Many}[<Qualifier>]By<Key>, e.g. findOneById / findManyByOrganizationId / findOneOpenByOrganizationIdAndEmail), findAll / findAll<Qualifier> (e.g. findAllActive)";
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
        "Repository ports may only declare CRUD-shaped methods; domain verbs belong on the aggregate (ADR-0024)",
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
            `Repository port method "${name}" is not in the cardinality-explicit vocabulary — repositories are dumb persistence (ADR-0024). ` +
            `Either it reads like a domain verb (put that behaviour on the aggregate and have the use case persist the result), ` +
            `or it omits the One/Many size (rename to e.g. ${name.startsWith("find") ? "findOne…/findMany…" : "…One/…Many"}). ` +
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
