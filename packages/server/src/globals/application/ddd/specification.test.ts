import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Option from "effect/Option";

import { Criteria, Spec } from "./specification.js";

type Row = {
  id: string;
  acceptedAt: Option.Option<string>;
  revokedAt: Option.Option<string>;
};

const open = (o: Partial<Row> = {}): Row => ({
  id: "1",
  acceptedAt: Option.none(),
  revokedAt: Option.none(),
  ...o,
});

describe("Spec builders — predicate + criteria in one object", () => {
  it("eq matches by field and records an Eq criterion", () => {
    const withId = Spec.eq<Row, "id">("id", "abc");
    deepStrictEqual(withId(open({ id: "abc" })), true);
    deepStrictEqual(withId(open({ id: "xyz" })), false);
    deepStrictEqual(withId.criteria, Criteria.Eq({ field: "id", value: "abc" }));
  });

  it("isNull / isNotNull read an Option field's None as null", () => {
    const accepted = Spec.isNotNull<Row>("acceptedAt");
    deepStrictEqual(accepted(open({ acceptedAt: Option.some("2026-01-01") })), true);
    deepStrictEqual(accepted(open()), false);
    deepStrictEqual(Spec.isNull<Row>("acceptedAt")(open()), true);
    deepStrictEqual(accepted.criteria, Criteria.IsNotNull({ field: "acceptedAt" }));
  });

  it("and / or / not compose both the predicate and the AST", () => {
    const isAccepted = Spec.isNotNull<Row>("acceptedAt");
    const isRevoked = Spec.isNotNull<Row>("revokedAt");
    const isOpen = Spec.not(Spec.or(isAccepted, isRevoked));

    deepStrictEqual(isOpen(open()), true);
    deepStrictEqual(isOpen(open({ acceptedAt: Option.some("2026-01-01") })), false);
    deepStrictEqual(isOpen(open({ revokedAt: Option.some("2026-01-01") })), false);

    deepStrictEqual(
      isOpen.criteria,
      Criteria.Not({
        node: Criteria.Or({
          nodes: [
            Criteria.IsNotNull({ field: "acceptedAt" }),
            Criteria.IsNotNull({ field: "revokedAt" }),
          ],
        }),
      }),
    );
  });
});
