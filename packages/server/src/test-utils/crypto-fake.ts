import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const BYTE = 256;
const COUNTER_BYTES = 4;

// The counter, little-endian, repeated across the buffer: every prefix of four
// or more bytes is unique per call, and so is the first byte for 256 calls.
const counterBytes = (size: number, counter: number): Uint8Array =>
  Uint8Array.from(
    { length: size },
    (_, index) => Math.floor(counter / BYTE ** (index % COUNTER_BYTES)) % BYTE,
  );

// Deterministic randomness for handler tests: each `randomBytes` call returns the
// next counter value, so ids stay unique and repeatable across runs. Digests stay
// real — a hash is not randomness.
export const CryptoFake: Layer.Layer<Crypto.Crypto> = Layer.effect(
  Crypto.Crypto,
  Effect.gen(function* () {
    const live = yield* Crypto.Crypto;
    let counter = 0;

    return Crypto.make({
      randomBytes: (size) => {
        counter += 1;

        return counterBytes(size, counter);
      },
      digest: live.digest,
    });
  }),
).pipe(Layer.provide(NodeCrypto.layer));
