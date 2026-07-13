import { describe, it } from "@effect/vitest";
import { deepStrictEqual, throws } from "assert";

import { Spec } from "@/platform/ddd/contracts/specification.js";

import { type ColumnMap, criteriaToWhere } from "./criteria-to-sql.js";

type Row = { id: string; acceptedAt: string | null; revokedAt: string | null };

const columns: ColumnMap = {
  id: "id",
  acceptedAt: "accepted_at",
  revokedAt: "revoked_at",
};

describe("criteriaToWhere", () => {
  it("compiles composed null checks to a parameter-free WHERE fragment", () => {
    const isOpen = Spec.not(
      Spec.or(Spec.isNotNull<Row>("acceptedAt"), Spec.isNotNull<Row>("revokedAt")),
    );
    const frag = criteriaToWhere(isOpen.criteria, columns);
    deepStrictEqual(frag.sql, '(NOT ("accepted_at" IS NOT NULL OR "revoked_at" IS NOT NULL))');
    deepStrictEqual(frag.values, []);
  });

  it("parameterizes Eq values (no interpolation into SQL text)", () => {
    const frag = criteriaToWhere(Spec.eq<Row, "id">("id", "abc").criteria, columns);
    deepStrictEqual(frag.sql, '"id" = $slonik_1');
    deepStrictEqual(frag.values, ["abc"]);
  });

  it("combines key eq + variant into one AND fragment", () => {
    const spec = Spec.and(Spec.eq<Row, "id">("id", "abc"), Spec.isNull<Row>("acceptedAt"));
    const frag = criteriaToWhere(spec.criteria, columns);
    deepStrictEqual(frag.sql, '("id" = $slonik_1 AND "accepted_at" IS NULL)');
    deepStrictEqual(frag.values, ["abc"]);
  });

  it("dies on an unmapped field (programmer error, not a query)", () => {
    const spec = Spec.eq<Row, "id">("id", "abc");
    throws(() => criteriaToWhere(spec.criteria, { acceptedAt: "accepted_at" }));
  });
});
