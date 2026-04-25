import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as TokenCipher from "./token-cipher.js";

const TEST_KEY = Redacted.make("test-key-32-chars-exactly-12345678");
const TestCipher = TokenCipher.layer({
  encryptionKey: TEST_KEY,
  algorithm: "aes-256-gcm",
});

describe("TokenCipher", () => {
  describe("encrypt", () => {
    it.effect("should encrypt a token and return base64 encoded consolidated data", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const token = Redacted.make("my-secret-token");

        const result = yield* tokenCipher.encrypt(token);

        deepStrictEqual(typeof result, "string");
        deepStrictEqual(Buffer.from(result, "base64").toString("base64"), result);
      }).pipe(Effect.provide(TestCipher)),
    );

    it.effect("should produce different ciphertexts for the same plaintext due to random IV", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const token = Redacted.make("my-secret-token");

        const result1 = yield* tokenCipher.encrypt(token);
        const result2 = yield* tokenCipher.encrypt(token);

        deepStrictEqual(result1 !== result2, true);
      }).pipe(Effect.provide(TestCipher)),
    );

    it.effect("should handle empty strings", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const token = Redacted.make("");

        const result = yield* tokenCipher.encrypt(token);

        deepStrictEqual(typeof result, "string");
        deepStrictEqual(Buffer.from(result, "base64").toString("base64"), result);
      }).pipe(Effect.provide(TestCipher)),
    );

    it.effect("should handle long strings", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const longString = "a".repeat(1000);
        const token = Redacted.make(longString);

        const result = yield* tokenCipher.encrypt(token);

        deepStrictEqual(typeof result, "string");
        deepStrictEqual(Buffer.from(result, "base64").toString("base64"), result);
      }).pipe(Effect.provide(TestCipher)),
    );
  });

  describe("decryptToken", () => {
    it.effect("should correctly decrypt an encrypted token", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const originalToken = Redacted.make("my-secret-token");

        const encrypted = yield* tokenCipher.encrypt(originalToken);
        const decrypted = yield* tokenCipher.decrypt(encrypted);

        deepStrictEqual(decrypted, Redacted.value(originalToken));
      }).pipe(Effect.provide(TestCipher)),
    );

    it.effect("should correctly handle empty strings", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const originalToken = Redacted.make("");

        const encrypted = yield* tokenCipher.encrypt(originalToken);
        const decrypted = yield* tokenCipher.decrypt(encrypted);

        deepStrictEqual(decrypted, "");
      }).pipe(Effect.provide(TestCipher)),
    );

    it.effect("should correctly handle long strings", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const longString = "a".repeat(1000);
        const originalToken = Redacted.make(longString);

        const encrypted = yield* tokenCipher.encrypt(originalToken);
        const decrypted = yield* tokenCipher.decrypt(encrypted);

        deepStrictEqual(decrypted, longString);
      }).pipe(Effect.provide(TestCipher)),
    );

    it.effect("should fail with invalid encrypted data", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;

        const invalidData = Buffer.from("invalid-data").toString("base64");

        const result = yield* tokenCipher.decrypt(invalidData).pipe(Effect.exit);

        deepStrictEqual(Exit.isFailure(result), true);
      }).pipe(Effect.provide(TestCipher)),
    );
  });

  describe("encryption properties", () => {
    it.effect("should produce different ciphertexts for different plaintexts", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const token1 = Redacted.make("first-token");
        const token2 = Redacted.make("second-token");

        const encrypted1 = yield* tokenCipher.encrypt(token1);
        const encrypted2 = yield* tokenCipher.encrypt(token2);

        deepStrictEqual(encrypted1 !== encrypted2, true);
      }).pipe(Effect.provide(TestCipher)),
    );

    it.effect("should maintain data integrity through encryption and decryption cycles", () =>
      Effect.gen(function* () {
        const tokenCipher = yield* TokenCipher.TokenCipher;
        const testCases = [
          "simple token",
          "",
          "a".repeat(1000),
          "special chars: !@#$%^&*()",
          "unicode: 你好世界",
          "numbers: 12345",
          "mixed: abc123!@#",
        ].map(Redacted.make);

        for (const token of testCases) {
          const encrypted = yield* tokenCipher.encrypt(token);
          const decrypted = yield* tokenCipher.decrypt(encrypted);

          deepStrictEqual(decrypted, Redacted.value(token));
        }
      }).pipe(Effect.provide(TestCipher)),
    );
  });

  describe("makeSchema", () => {
    it.effect("should correctly encode and decode data through the schema", () =>
      Effect.gen(function* () {
        const TestData = Schema.Struct({
          id: Schema.Number,
          name: Schema.String,
        });

        const schema = yield* TokenCipher.makeSchema(TestData, {
          encryptionKey: TEST_KEY,
          algorithm: "aes-256-gcm",
        });
        const testData = { id: 123, name: "test" };

        const encoded = yield* Schema.encode(schema)(Redacted.make(testData));

        deepStrictEqual(typeof encoded, "string");
        deepStrictEqual(Buffer.from(encoded, "base64").toString("base64"), encoded);

        const decoded = Redacted.value(yield* Schema.decode(schema)(encoded));

        deepStrictEqual(decoded, testData);
      }),
    );

    it.effect("should handle complex data structures", () =>
      Effect.gen(function* () {
        const ComplexData = Schema.Struct({
          nested: Schema.Struct({
            array: Schema.Array(Schema.Number),
            optional: Schema.optional(Schema.String),
          }),
          date: Schema.String,
        });

        const schema = yield* TokenCipher.makeSchema(ComplexData, {
          encryptionKey: TEST_KEY,
          algorithm: "aes-256-gcm",
        });
        const testData = {
          nested: {
            array: [1, 2, 3],
            optional: "test",
          },
          date: "2024-03-20",
        };

        const encoded = yield* Schema.encode(schema)(Redacted.make(testData));
        deepStrictEqual(typeof encoded, "string");
        deepStrictEqual(Buffer.from(encoded, "base64").toString("base64"), encoded);

        const decoded = Redacted.value(yield* Schema.decode(schema)(encoded));

        deepStrictEqual(decoded, testData);
      }),
    );

    it.effect("should fail when decrypting with invalid data", () =>
      Effect.gen(function* () {
        const TestData = Schema.Struct({
          id: Schema.Number,
        });

        const schema = yield* TokenCipher.makeSchema(TestData, {
          encryptionKey: TEST_KEY,
          algorithm: "aes-256-gcm",
        });

        const result = yield* Schema.decode(schema)(
          "invaliddata" as typeof TokenCipher.EncryptedToken.Encoded,
        ).pipe(Effect.exit);

        deepStrictEqual(Exit.isFailure(result), true);
      }),
    );

    it.effect("should fail when decoding invalid JSON after decryption", () =>
      Effect.gen(function* () {
        const TestData = Schema.Struct({
          id: Schema.Number,
        });

        const schema1 = yield* TokenCipher.makeSchema(TestData, {
          encryptionKey: Redacted.make("different-key-32-chars-exactly-123"),
          algorithm: "aes-256-gcm",
        });
        const schema2 = yield* TokenCipher.makeSchema(TestData, {
          encryptionKey: TEST_KEY,
          algorithm: "aes-256-gcm",
        });

        const encoded = yield* Schema.encode(schema1)(Redacted.make({ id: 123 }));

        deepStrictEqual(typeof encoded, "string");
        deepStrictEqual(Buffer.from(encoded, "base64").toString("base64"), encoded);

        const result = yield* Schema.decode(schema2)(encoded).pipe(Effect.exit);
        deepStrictEqual(Exit.isFailure(result), true);
      }),
    );

    it.effect("should handle empty objects", () =>
      Effect.gen(function* () {
        const EmptyStruct = Schema.Struct({});
        const schema = yield* TokenCipher.makeSchema(EmptyStruct, {
          encryptionKey: TEST_KEY,
          algorithm: "aes-256-gcm",
        });
        const testData = {};

        const encoded = yield* Schema.encode(schema)(Redacted.make(testData));
        deepStrictEqual(typeof encoded, "string");
        deepStrictEqual(Buffer.from(encoded, "base64").toString("base64"), encoded);

        const decoded = Redacted.value(yield* Schema.decode(schema)(encoded));

        deepStrictEqual(decoded, testData);
      }),
    );

    it.effect("should use the specified encryption algorithm", () =>
      Effect.gen(function* () {
        const TestData = Schema.Struct({
          id: Schema.Number,
        });

        const schema = yield* TokenCipher.makeSchema(TestData, {
          encryptionKey: TEST_KEY,
          algorithm: "aes-256-gcm",
        });

        const testData = { id: 123 };
        const encoded = yield* Schema.encode(schema)(Redacted.make(testData));
        deepStrictEqual(typeof encoded, "string");
        deepStrictEqual(Buffer.from(encoded, "base64").toString("base64"), encoded);

        const decoded = Redacted.value(yield* Schema.decode(schema)(encoded));

        deepStrictEqual(decoded, testData);
      }),
    );
  });

  describe("makeSchemaWithContext", () => {
    it.effect("should correctly encode and decode data through the schema", () =>
      Effect.gen(function* () {
        const TestData = Schema.Struct({
          id: Schema.Number,
          name: Schema.String,
        });

        const schema = yield* TokenCipher.makeSchemaWithContext(TestData);
        const testData = { id: 123, name: "test" };

        const encoded = yield* Schema.encode(schema)(Redacted.make(testData));

        deepStrictEqual(typeof encoded, "string");
        deepStrictEqual(Buffer.from(encoded, "base64").toString("base64"), encoded);

        const decoded = Redacted.value(yield* Schema.decode(schema)(encoded));

        deepStrictEqual(decoded, testData);
      }).pipe(Effect.provide(TestCipher)),
    );
  });
});
