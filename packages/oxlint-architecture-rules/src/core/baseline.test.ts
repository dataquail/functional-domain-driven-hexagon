import { describe, expect, it } from "vitest";

import type { Violation } from "../domain/violation.js";
import {
  baselineOf,
  decodeBaseline,
  EMPTY_BASELINE,
  makeBaselineFilter,
  staleEntriesOf,
  unbaselined,
} from "./baseline.js";

const violation = (
  file: string,
  subject: string | null = "packages/database/src/index.ts",
): Violation => ({
  kind: "import",
  ruleName: "domain-isolation",
  message: "domain/ may only reach the contracts tier.",
  file,
  subject,
});

const one = violation("packages/server/src/modules/todos/domain/todo/todo.root.ts");
const two = violation("packages/server/src/modules/user/domain/user/user.root.ts");

describe("baselineOf", () => {
  it("records each violation once, in a stable order", () => {
    expect(baselineOf([two, one, one]).entries).toEqual([
      "import|domain-isolation|packages/server/src/modules/todos/domain/todo/todo.root.ts|packages/database/src/index.ts",
      "import|domain-isolation|packages/server/src/modules/user/domain/user/user.root.ts|packages/database/src/index.ts",
    ]);
  });
});

describe("makeBaselineFilter", () => {
  const baseline = baselineOf([one]);

  it("carries a violation it recorded", () => {
    expect(makeBaselineFilter(baseline).isBaselined(one)).toBe(true);
  });

  it("does not carry one it did not", () => {
    expect(makeBaselineFilter(baseline).isBaselined(two)).toBe(false);
  });

  // The property the whole mechanism rests on: an entry survives edits to the
  // file it names. One keyed on a line number would go stale on the first
  // reformat and silently re-admit the violation it was meant to record.
  it("still carries a violation after the file around it moves", () => {
    expect(makeBaselineFilter(baseline).isBaselined({ ...one, message: "reworded since" })).toBe(
      true,
    );
  });

  it("stops carrying it once the violation is a different one", () => {
    expect(
      makeBaselineFilter(baseline).isBaselined({ ...one, subject: "packages/contracts/src/x.ts" }),
    ).toBe(false);
  });
});

describe("staleEntriesOf", () => {
  // The ratchet's teeth. A baseline allowed to keep entries the code no longer
  // produces stops being a record of debt and becomes a place to hide.
  it("names entries the code no longer produces", () => {
    expect(staleEntriesOf(baselineOf([one, two]), [one])).toEqual([
      "import|domain-isolation|packages/server/src/modules/user/domain/user/user.root.ts|packages/database/src/index.ts",
    ]);
  });

  it("is quiet while every entry still fires", () => {
    expect(staleEntriesOf(baselineOf([one]), [one, two])).toEqual([]);
  });
});

describe("unbaselined", () => {
  it("leaves only what the baseline does not carry", () => {
    expect(unbaselined(baselineOf([one]), [one, two])).toEqual([two]);
  });

  it("reports everything when there is no baseline", () => {
    expect(unbaselined(EMPTY_BASELINE, [one, two])).toEqual([one, two]);
  });
});

describe("decodeBaseline", () => {
  // A missing or malformed baseline carries nothing, which is the safe
  // direction: every violation reports.
  it("carries nothing when the file is absent or unreadable", () => {
    expect(decodeBaseline(undefined)).toEqual(EMPTY_BASELINE);
    expect(decodeBaseline({ entries: "not an array" })).toEqual(EMPTY_BASELINE);
  });

  it("ignores entries that are not fingerprints", () => {
    expect(decodeBaseline({ version: 1, entries: ["a|b|c|d", 7, null] }).entries).toEqual([
      "a|b|c|d",
    ]);
  });
});
