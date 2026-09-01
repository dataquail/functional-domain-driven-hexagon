import type { Violation } from "../domain/violation.js";
import { fingerprintOf } from "../domain/violation.js";

// A baseline is the set of violations a repository is choosing to carry while it
// adopts a policy. It exists so a rule can be turned on before the code is
// clean — the alternative is not turning it on.
//
// Two properties make it a ratchet rather than a suppression list:
//
//   - Entries are line-independent fingerprints, so an entry survives edits to
//     the file it names. One keyed on a position would go stale on the first
//     reformat and silently re-admit the violation it was meant to record.
//   - An entry that no longer fires is an error, not a shrug. Fixing a violation
//     must remove its entry, or the floor never rises.
export type Baseline = {
  readonly version: 1;
  readonly entries: ReadonlyArray<string>;
};

export const EMPTY_BASELINE: Baseline = { version: 1, entries: [] };

export const baselineOf = (violations: Iterable<Violation>): Baseline => ({
  version: 1,
  entries: [...new Set([...violations].map(fingerprintOf))].sort(),
});

export const decodeBaseline = (raw: unknown): Baseline => {
  if (typeof raw !== "object" || raw === null) return EMPTY_BASELINE;
  const entries = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return EMPTY_BASELINE;
  return { version: 1, entries: entries.filter((one): one is string => typeof one === "string") };
};

export const serializeBaseline = (baseline: Baseline): string =>
  `${JSON.stringify(baseline, null, 2)}\n`;

export type BaselineFilter = {
  readonly isBaselined: (violation: Violation) => boolean;
};

export const makeBaselineFilter = (baseline: Baseline): BaselineFilter => {
  const entries = new Set(baseline.entries);
  return { isBaselined: (violation) => entries.has(fingerprintOf(violation)) };
};

// The ratchet's teeth: entries the code no longer produces. A baseline that is
// allowed to keep them stops being a record of debt and becomes a place to hide.
export const staleEntriesOf = (
  baseline: Baseline,
  violations: Iterable<Violation>,
): ReadonlyArray<string> => {
  const current = new Set([...violations].map(fingerprintOf));
  return baseline.entries.filter((entry) => !current.has(entry));
};

export const unbaselined = (
  baseline: Baseline,
  violations: Iterable<Violation>,
): ReadonlyArray<Violation> => {
  const { isBaselined } = makeBaselineFilter(baseline);
  return [...violations].filter((violation) => !isBaselined(violation));
};
