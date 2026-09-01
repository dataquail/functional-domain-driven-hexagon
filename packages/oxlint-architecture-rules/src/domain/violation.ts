export type ViolationKind = "import" | "export" | "structure" | "member";

export type Violation = {
  readonly kind: ViolationKind;
  readonly ruleName: string;
  readonly message: string;
  // Repo-relative, forward slashes.
  readonly file: string;
  // The other end of the violated relationship: the resolved import target, the
  // restricted symbol, the missing sibling, the disallowed member. `null` when
  // the file alone is the violation.
  readonly subject: string | null;
};

// Deliberately excludes line and column so an entry survives ordinary edits to
// the file it names — a baseline keyed on positions would go stale on the first
// reformat and silently re-admit a violation it was never meant to cover.
export const fingerprintOf = (violation: Violation): string =>
  [violation.kind, violation.ruleName, violation.file, violation.subject ?? ""].join("|");

// `{name}` in a message is replaced with the subject, so a rule can quote the
// offending symbol without the config needing a callback.
export const formatMessage = (violation: Violation): string =>
  `[${violation.ruleName}] ${violation.message.replaceAll("{name}", violation.subject ?? "")}`;
