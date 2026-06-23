import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";

import { API_TOKEN_PREFIX, assembleToken, displayPrefix, hashToken } from "./api-token-token.js";

describe("api-token-token", () => {
  it("assembles the wire format pat_<publicId>_<secret>", () => {
    deepStrictEqual(assembleToken("abcd1234", "secret"), `${API_TOKEN_PREFIX}_abcd1234_secret`);
  });

  it("derives a non-secret display prefix that omits the secret", () => {
    const token = assembleToken("abcd1234", "supersecretvalue");
    const prefix = displayPrefix("abcd1234");
    deepStrictEqual(prefix, "pat_abcd1234");
    ok(!prefix.includes("supersecretvalue"));
    ok(token.startsWith(prefix));
  });

  it("hashes deterministically and differs across inputs", () => {
    deepStrictEqual(hashToken("pat_a_b"), hashToken("pat_a_b"));
    ok(hashToken("pat_a_b") !== hashToken("pat_a_c"));
    // sha256 hex is 64 chars
    deepStrictEqual(hashToken("anything").length, 64);
  });
});
