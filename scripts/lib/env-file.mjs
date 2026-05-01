// Minimal `.env` reader/writer used by dev-bootstrap.mjs and auth-reset.mjs.
// Treats `.env` as an ordered list of `KEY=VALUE` lines (with comments and
// blanks preserved). We don't reach for the `dotenv` package here because:
//   1. it's a single-purpose tool — adding a runtime dep for ~30 lines of code
//      isn't worth it
//   2. dotenv parses values in ways we don't want when *writing* (e.g. quoting,
//      multiline expansion); we want byte-for-byte fidelity for everything we
//      don't explicitly touch.

import { readFileSync, writeFileSync } from "node:fs";

const KV_LINE = /^([A-Z_][A-Z0-9_]*)=(.*)$/;

export function readEnv(path) {
  return parseEnv(readFileSync(path, "utf8"));
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = KV_LINE.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// Update keys in-place, preserving file order, comments, and blank lines.
// Keys not present are appended to the end. Returns the keys actually changed.
export function updateEnv(path, updates) {
  const original = readFileSync(path, "utf8");
  const lines = original.split("\n");
  const seen = new Set();
  const changed = [];
  const out = lines.map((line) => {
    const m = KV_LINE.exec(line);
    if (m && Object.prototype.hasOwnProperty.call(updates, m[1])) {
      seen.add(m[1]);
      const nextValue = String(updates[m[1]]);
      if (m[2] !== nextValue) changed.push(m[1]);
      return `${m[1]}=${nextValue}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) {
      out.push(`${k}=${String(v)}`);
      changed.push(k);
    }
  }
  const next = out.join("\n");
  if (next !== original) writeFileSync(path, next);
  return changed;
}
