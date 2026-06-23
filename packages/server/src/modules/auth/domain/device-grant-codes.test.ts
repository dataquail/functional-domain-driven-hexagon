import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";

import { toUserCode, USER_CODE_ALPHABET } from "./device-grant-codes.js";

describe("toUserCode", () => {
  it("formats 8 chars as XXXX-XXXX from the confusable-free alphabet", () => {
    const code = toUserCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    deepStrictEqual(code, "ABCD-EFGH");
    deepStrictEqual(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), true);
  });

  it("maps every byte into the alphabet (modulo) and omits 0/O/1/I", () => {
    const code = toUserCode(new Uint8Array([255, 254, 253, 252, 251, 250, 249, 248]));
    for (const ch of code.replace("-", "")) ok(USER_CODE_ALPHABET.includes(ch));
    ok(!/[O01I]/.test(code));
  });
});
