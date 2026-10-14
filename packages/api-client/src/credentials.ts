import { homedir } from "node:os";

import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { tokenFromEnv } from "./config.js";

// On-disk credential file: `$XDG_CONFIG_HOME/org-cli/credentials.json`
// (falls back to `~/.config`). Holds the device-flow / pasted token and an
// optional default org so todo commands don't need `--org` every time.
const CONFIG_DIR = "org-cli";
const FILE_NAME = "credentials.json";

export class Credentials extends Schema.Class<Credentials, { readonly brand: "Credentials" }>(
  "Credentials",
)({
  token: Schema.optional(Schema.String),
  defaultOrgId: Schema.optional(Schema.String),
}) {}

const empty = Credentials.make({});

const credentialsPath = Effect.gen(function* () {
  const path = yield* Path.Path;

  const base = yield* Config.String("XDG_CONFIG_HOME").pipe(
    Config.withDefault(path.join(homedir(), ".config")),
  );

  return path.join(base, CONFIG_DIR, FILE_NAME);
});

const CredentialsFile = Schema.fromJsonString(Credentials, { space: 2 });

const decode = Schema.decodeUnknownEffect(CredentialsFile);

const encode = Schema.encodeEffect(CredentialsFile);

// Missing or unparseable file → empty credentials (first run, or a stale
// hand-edit shouldn't crash the CLI). Genuine FS errors are defects.
export const readCredentials: Effect.Effect<Credentials, never, FileSystem.FileSystem | Path.Path> =
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const file = yield* credentialsPath;

    if (!(yield* fs.exists(file))) return empty;
    const raw = yield* fs.readFileString(file);

    return yield* decode(raw).pipe(Effect.orElseSucceed(() => empty));
  }).pipe(Effect.orDie);

const writeCredentials = (
  creds: Credentials,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = yield* credentialsPath;
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    const contents = yield* encode(creds);
    yield* fs.writeFileString(file, `${contents}\n`);
    // Token is a bearer secret — keep the file owner-only.
    yield* fs.chmod(file, 0o600);
  }).pipe(Effect.orDie);

export const saveToken = (token: string) =>
  Effect.flatMap(readCredentials, (c) => writeCredentials(Credentials.make({ ...c, token })));

export const clearToken = Effect.flatMap(readCredentials, (c) =>
  writeCredentials(Credentials.make({ defaultOrgId: c.defaultOrgId })),
);

export const saveDefaultOrg = (defaultOrgId: string) =>
  Effect.flatMap(readCredentials, (c) =>
    writeCredentials(Credentials.make({ ...c, defaultOrgId })),
  );

// Env token (CI) wins over the stored one; none when neither is set.
export const resolveToken = (creds: Credentials): Effect.Effect<Option.Option<string>> =>
  Effect.map(
    tokenFromEnv,
    Option.orElse(() => Option.fromUndefinedOr(creds.token)),
  );
