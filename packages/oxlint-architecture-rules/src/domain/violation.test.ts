import { describe, expect, it } from "vitest";

import { fingerprintOf, formatMessage, type Violation } from "./violation.js";

const violation: Violation = {
  kind: "import",
  ruleName: "domain-isolation",
  message: "domain/ may only reach the contracts tier.",
  file: "packages/server/src/modules/todos/domain/todo/todo.root.ts",
  subject: "packages/database/src/index.ts",
};

describe("fingerprintOf", () => {
  // The property a ratchet baseline depends on: an entry must survive edits to
  // the file it names. A fingerprint carrying a position would go stale on the
  // first reformat and silently re-admit the violation it was meant to record.
  it("identifies a violation by relationship, not position", () => {
    expect(fingerprintOf(violation)).toBe(
      "import|domain-isolation|packages/server/src/modules/todos/domain/todo/todo.root.ts|packages/database/src/index.ts",
    );
  });

  it("distinguishes two rules reporting the same edge", () => {
    expect(fingerprintOf({ ...violation, ruleName: "commands-isolation" })).not.toBe(
      fingerprintOf(violation),
    );
  });

  it("handles a violation the file alone carries", () => {
    expect(fingerprintOf({ ...violation, subject: null })).toBe(
      "import|domain-isolation|packages/server/src/modules/todos/domain/todo/todo.root.ts|",
    );
  });
});

describe("formatMessage", () => {
  it("quotes the offending subject where the message asks for it", () => {
    expect(formatMessage({ ...violation, message: 'Method "{name}" is not allowed.' })).toBe(
      '[domain-isolation] Method "packages/database/src/index.ts" is not allowed.',
    );
  });

  it("names the rule so one oxlint rule id can carry many policies", () => {
    expect(formatMessage(violation)).toBe(
      "[domain-isolation] domain/ may only reach the contracts tier.",
    );
  });
});

describe("a violation with no subject", () => {
  // A structure root reports the folder, an import rule the target — but a rule
  // that has nothing to name still has to render its message.
  it("renders {name} as nothing rather than as the word undefined", () => {
    expect(
      formatMessage({
        kind: "structure",
        ruleName: "server/taxonomy",
        message: "This folder is not part of the taxonomy: {name}.",
        file: "packages/server/src/modules/alpha/helpers/x.ts",
        subject: null,
      }),
    ).toBe("[server/taxonomy] This folder is not part of the taxonomy: .");
  });
});
