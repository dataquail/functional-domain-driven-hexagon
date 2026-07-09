import * as crypto from "node:crypto";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

export const EncryptedToken = Schema.String.pipe(Schema.brand("encryptedToken"));
export type EncryptedToken = typeof EncryptedToken.Type;

export const EncryptedTokenEncoded = Schema.toEncoded(EncryptedToken);
export type EncryptedTokenEncoded = typeof EncryptedTokenEncoded.Type;

type MakeOpts = {
  encryptionKey: Redacted.Redacted;
  algorithm: crypto.CipherGCMTypes;
};

const make = (opts: MakeOpts) => {
  const { algorithm, encryptionKey } = opts;
  const keyLength = algorithm.startsWith("aes-128") ? 16 : 32;
  const normalizedKey = crypto
    .createHash("sha256")
    .update(Redacted.value(encryptionKey))
    .digest()
    .subarray(0, keyLength);

  return {
    encrypt: (token: Redacted.Redacted) =>
      Effect.sync(() => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, normalizedKey, iv);

        const encrypted = Buffer.concat([
          cipher.update(Redacted.value(token), "utf8"),
          cipher.final(),
        ]);

        const authTag = cipher.getAuthTag();

        const consolidatedBuffer = Buffer.concat([iv, encrypted, authTag]);
        return EncryptedToken.make(consolidatedBuffer.toString("base64"));
      }).pipe(Effect.withSpan("TokenCipher.encrypt")),

    decrypt: (consolidatedData: string) =>
      Effect.sync(() => {
        const buffer = Buffer.from(consolidatedData, "base64");

        const iv = buffer.subarray(0, 16);
        const authTag = buffer.subarray(buffer.length - 16);
        const encryptedData = buffer.subarray(16, buffer.length - 16);

        const decipher = crypto.createDecipheriv(algorithm, normalizedKey, iv);

        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString("utf8");
      }).pipe(Effect.withSpan("TokenCipher.decrypt")),
  };
};

export class TokenCipher extends Context.Service<TokenCipher, ReturnType<typeof make>>()(
  "TokenCipher",
) {}

export const layer = flow(make, Layer.succeed(TokenCipher));

const makeSchemaTransform = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  cipher: ReturnType<typeof make>,
) => {
  // `RedactedFromValue` (not `Redacted`) so the decoded type is `Redacted<A>`
  // while the *encoded* side stays the plain JSON string — `Redacted` would
  // wrap both and treat its content as opaque, so `fromJsonString` never runs.
  const JsonSchema = Schema.RedactedFromValue(Schema.fromJsonString(schema));
  return EncryptedToken.pipe(
    Schema.decodeTo(JsonSchema, {
      decode: SchemaGetter.transformOrFail((encryptedToken) => cipher.decrypt(encryptedToken)),
      encode: SchemaGetter.transformOrFail((jsonString) =>
        cipher.encrypt(Redacted.make(jsonString)),
      ),
    }),
  );
};

export const makeSchema = <A, I, RD, RE>(schema: Schema.Codec<A, I, RD, RE>, opts: MakeOpts) =>
  Effect.sync(() => {
    const cipher = make(opts);
    return makeSchemaTransform(schema, cipher);
  });

export const makeSchemaWithContext = <A, I, RD, RE>(schema: Schema.Codec<A, I, RD, RE>) =>
  Effect.map(TokenCipher, (cipher) => makeSchemaTransform(schema, cipher));
