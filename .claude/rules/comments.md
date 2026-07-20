# Rule: comments

**Scope:** all code, all packages.

Code should be self-documenting; comments are a last resort, not documentation.

- Don't write long, multi-sentence comments.
- Don't reference code from elsewhere in the codebase in comments — file names, wiring, and call sites drift; the dependency graph already records them.
- The code itself should be self-documenting by way of clear and even verbosely named variables and functions.
- Higher-level behavior should be documented through tests.
- Before commenting, ask:
  - "Is there a test that demonstrates why it works this way?" If not, add one.
  - "Can I extract a function with a name and arguments that are self-documenting?"
- The only comment worth keeping states a constraint the code _cannot_ express — an external-system quirk, an ordering invariant, a deliberate deviation from the obvious approach — in one line. Never narrate what the next line does, restate a signature, cite where code came from, or leave commented-out code.
- Exception: the required header in `*.endpoint.test.ts` parity tokens (see the server-testing rule, Endpoint test naming).
