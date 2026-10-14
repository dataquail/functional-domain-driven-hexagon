import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { migrations } from "../src/migrations/index.js";
import { migrationsLoader, MODULE_SCHEMAS } from "../src/migrator.js";

const migrationsDirectory = Effect.gen(function* () {
  const path = yield* Path.Path;
  const here = yield* path.fromFileUrl(new URL(import.meta.url));

  return path.join(path.dirname(here), "../src/migrations");
});

describe("migrations", () => {
  layer(NodeServices.layer)((it) => {
    // The registry is hand-maintained, so a new migration file that nobody added
    // to it would simply never run. This is the guard against that.
    it.effect("registers exactly the migration files on disk", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const files = yield* fs.readDirectory(yield* migrationsDirectory);

        const onDisk = Arr.getSomes(
          files.map((file) =>
            Option.fromNullOr(/^(\d+_.+)\.ts$/.exec(file)).pipe(
              Option.flatMap((match) => Option.fromUndefinedOr(match[1])),
            ),
          ),
        );

        expect(Object.keys(migrations).sort()).toEqual(onDisk.sort());
      }),
    );

    it.effect("resolves every migration, ordered by a contiguous id", () =>
      Effect.gen(function* () {
        const list = yield* migrationsLoader;
        expect(list.map(([id]) => id)).toEqual(
          Array.from({ length: list.length }, (_, index) => index + 1),
        );
        expect(list.map(([, name]) => name).slice(0, 2)).toEqual([
          "create_schema_user",
          "create_schema_organization",
        ]);
      }),
    );

    it.effect("exports an Effect from every migration", () =>
      Effect.sync(() => {
        for (const [file, migration] of Object.entries(migrations)) {
          expect(Effect.isEffect(migration), `${file} must export an Effect`).toBe(true);
        }
      }),
    );

    it.effect("creates a schema for every module that owns one", () =>
      Effect.gen(function* () {
        const names = (yield* migrationsLoader).map(([, name]) => name);

        for (const schema of MODULE_SCHEMAS) {
          expect(names).toContain(`create_schema_${schema}`);
        }
      }),
    );
  });
});
