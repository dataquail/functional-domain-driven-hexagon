/* eslint-disable */
/**
 * @fileoverview A module's SQL may only address its own Postgres schema
 * (ADR-0020). Cross-module reads go through an `interface/events/` adapter or a
 * `domain/ports/acl/` port, never a JOIN across schemas.
 *
 * Three things this has to get right, each of which a naive FROM/JOIN regex
 * gets wrong and each of which turns the rule into noise or silence:
 *
 *   - a quoted schema (`"user".users`), which ADR-0020 requires on reserved
 *     words, and which an unquoted-only pattern misses entirely;
 *   - a module whose schema is not named after its folder (`role` owns
 *     `platform`), which otherwise reports every statement it makes;
 *   - `FROM unnest(...)` and CTE names, which are not tables.
 */

import { isTestFile } from "./is-test-file.mjs";

// A module folder whose owning schema is named differently. Everything absent
// here owns the schema named after its folder.
const SCHEMA_BY_MODULE = { role: "platform" };

// Set-returning functions and values-lists are not tables, so a bare name here
// is not an unqualified table reference.
const NOT_A_TABLE = new Set(["unnest", "values", "generate_series", "jsonb_to_recordset"]);

const TABLE_REFERENCE =
  /\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:"?([a-z_][a-z0-9_]*)"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?/gi;

const CTE_NAME = /\b(?:WITH|,)\s+([a-z_][a-z0-9_]*)\s+AS\s*\(/gi;

const moduleOf = (filename) => {
  const matched = /\/modules\/([^/]+)\//.exec(filename);
  return matched === null ? null : matched[1];
};

const sqlTextOf = (node) =>
  node.quasi.quasis
    .map((q) => q.value.raw)
    .join(" ? ")
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

export default {
  meta: {
    type: "problem",
    docs: {
      description: "A module's SQL may only address the Postgres schema it owns (ADR-0020)",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },

  create(context) {
    const module = moduleOf(context.filename);
    if (module === null || isTestFile(context.filename)) {
      return {};
    }
    const ownSchema = SCHEMA_BY_MODULE[module] ?? module;

    return {
      TaggedTemplateExpression(node) {
        if (node.tag.type !== "Identifier" || node.tag.name !== "sql") {
          return;
        }
        const text = sqlTextOf(node);

        const localNames = new Set();
        for (const [, name] of text.matchAll(CTE_NAME)) {
          localNames.add(name.toLowerCase());
        }

        const reported = new Set();
        for (const [, schema, table] of text.matchAll(TABLE_REFERENCE)) {
          const name = table.toLowerCase();
          if (schema === undefined) {
            if (NOT_A_TABLE.has(name) || localNames.has(name)) continue;
            if (reported.has(name)) continue;
            reported.add(name);
            context.report({
              node,
              message:
                `Table "${table}" is not schema-qualified. Address it as ` +
                `"${ownSchema}".${table} — ADR-0020 gives every module its own Postgres schema.`,
            });
            continue;
          }
          if (schema.toLowerCase() === ownSchema) continue;
          const key = `${schema}.${name}`;
          if (reported.has(key)) continue;
          reported.add(key);
          context.report({
            node,
            message:
              `Module "${module}" owns the "${ownSchema}" schema and must not read ` +
              `"${schema}"."${table}". Cross-module data comes from an interface/events ` +
              `adapter or a domain/ports/acl/ port, never a cross-schema query (ADR-0020).`,
          });
        }
      },
    };
  },
};
