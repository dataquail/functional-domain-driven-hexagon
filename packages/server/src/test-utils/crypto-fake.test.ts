import { deepStrictEqual, notDeepStrictEqual } from "node:assert";

import { describe, layer } from "@effect/vitest";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";

import { CryptoFake } from "./crypto-fake";

describe("CryptoFake", () => {
  layer(CryptoFake)((it) => {
    it.effect("mints distinct ids and a counter in the leading bytes", () =>
      Effect.gen(function* () {
        const crypto = yield* Crypto.Crypto;
        const first = yield* crypto.randomUUIDv4;
        const second = yield* crypto.randomUUIDv4;

        notDeepStrictEqual(first, second);
        deepStrictEqual(yield* crypto.randomBytes(2), new Uint8Array([3, 0]));
      }),
    );
  });
});
