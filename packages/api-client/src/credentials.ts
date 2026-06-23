import { homedir } from "node:os";

import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { tokenFromEnv } from "./config.js";

// On-disk credential file: `$XDG_CONFIG_HOME/org-cli/credentials.json`
// (falls back to `~/.config`). Holds the device-flow / pasted token and an
// optional default org so todo commands don't need `--org` every time.
const CONFIG_DIR = "org-cli";
const FILE_NAME = "credentials.json";

export class Credentials extends Schema.Class<Credentials>("Credentials")({
  token: Schema.optional(Schema.String),
  defaultOrgId: Schema.optional(Schema.String),
}) {}

const empty = Credentials.make({});

const credentialsPath = Effect.gen(function* () {
  const path = yield* Path.Path;
  const base = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config");
  return path.join(base, CONFIG_DIR, FILE_NAME);
});

const decode = Schema.decodeUnknown(Schema.parseJson(Credentials));

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
    yield* fs.writeFileString(file, `${JSON.stringify(creds, null, 2)}\n`);
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

// Env token (CI) wins over the stored one; null when neither is set.
export const resolveToken = (creds: Credentials): string | null =>
  tokenFromEnv() ?? creds.token ?? null;
