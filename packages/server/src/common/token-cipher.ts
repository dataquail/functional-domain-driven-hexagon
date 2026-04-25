import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as ParseResult from "effect/ParseResult";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as crypto from "node:crypto";

export const EncryptedToken = Schema.String.pipe(Schema.brand("encryptedToken"));
export type EncryptedToken = typeof EncryptedToken.Type;

export const EncryptedTokenEncoded = Schema.encodedSchema(EncryptedToken);
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

export class TokenCipher extends Effect.Tag("TokenCipher")<
  TokenCipher,
  ReturnType<typeof make>
>() {}

export const layer = flow(make, Layer.succeed(TokenCipher));

const makeSchemaTransform = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  cipher: ReturnType<typeof make>,
) => {
  const JsonSchema = Schema.Redacted(Schema.parseJson(schema));
  return Schema.transformOrFail(EncryptedToken, JsonSchema, {
    strict: true,
    decode: (encryptedToken, _, ast) =>
      cipher
        .decrypt(encryptedToken)
        .pipe(
          Effect.catchAll(() =>
            Effect.fail(new ParseResult.Type(ast, encryptedToken, "Failed to decrypt token")),
          ),
        ),
    encode: (jsonString) => cipher.encrypt(Redacted.make(jsonString)),
  });
};

export const makeSchema = <A, I, R>(schema: Schema.Schema<A, I, R>, opts: MakeOpts) =>
  Effect.sync(() => {
    const cipher = make(opts);
    return makeSchemaTransform(schema, cipher);
  });

export const makeSchemaWithContext = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  TokenCipher.use((cipher) => makeSchemaTransform(schema, cipher));
