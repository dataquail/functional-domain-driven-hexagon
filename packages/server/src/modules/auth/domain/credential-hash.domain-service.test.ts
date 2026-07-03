import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";

import { CredentialHash } from "./credential-hash.domain-service.js";

describe("CredentialHash", () => {
  it("hashes deterministically and differs across inputs", () => {
    deepStrictEqual(CredentialHash.of("pat_a_b"), CredentialHash.of("pat_a_b"));
    ok(CredentialHash.of("pat_a_b") !== CredentialHash.of("pat_a_c"));
    // sha256 hex is 64 chars
    deepStrictEqual(CredentialHash.of("anything").length, 64);
  });
});
