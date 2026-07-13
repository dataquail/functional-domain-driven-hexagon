import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";

import { Spec } from "./specification.js";

type Row = { id: string; acceptedAt: string | null; revokedAt: string | null };

const open = (o: Partial<Row> = {}): Row => ({
  id: "1",
  acceptedAt: null,
  revokedAt: null,
  ...o,
});

describe("Spec builders — predicate + criteria in one object", () => {
  it("eq matches by field and records an Eq criterion", () => {
    const withId = Spec.eq<Row, "id">("id", "abc");
    deepStrictEqual(withId(open({ id: "abc" })), true);
    deepStrictEqual(withId(open({ id: "xyz" })), false);
    deepStrictEqual(withId.criteria, { _tag: "Eq", field: "id", value: "abc" });
  });

  it("isNull / isNotNull match nullability", () => {
    const accepted = Spec.isNotNull<Row>("acceptedAt");
    deepStrictEqual(accepted(open({ acceptedAt: "2026-01-01" })), true);
    deepStrictEqual(accepted(open()), false);
    deepStrictEqual(accepted.criteria, { _tag: "IsNotNull", field: "acceptedAt" });
  });

  it("and / or / not compose both the predicate and the AST", () => {
    const isAccepted = Spec.isNotNull<Row>("acceptedAt");
    const isRevoked = Spec.isNotNull<Row>("revokedAt");
    const isOpen = Spec.not(Spec.or(isAccepted, isRevoked));

    deepStrictEqual(isOpen(open()), true);
    deepStrictEqual(isOpen(open({ acceptedAt: "2026-01-01" })), false);
    deepStrictEqual(isOpen(open({ revokedAt: "2026-01-01" })), false);

    deepStrictEqual(isOpen.criteria, {
      _tag: "Not",
      node: {
        _tag: "Or",
        nodes: [
          { _tag: "IsNotNull", field: "acceptedAt" },
          { _tag: "IsNotNull", field: "revokedAt" },
        ],
      },
    });
  });
});
