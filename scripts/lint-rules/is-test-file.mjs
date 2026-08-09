// oxlint's per-override config has no `ignores` counterpart, and a negated glob
// in `files` widens the match instead of narrowing it. Rules that ESLint scoped
// with `ignores` therefore carry their own exemption, which also makes the
// exemption testable rather than buried in lint config.
export const isTestFile = (filename) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
