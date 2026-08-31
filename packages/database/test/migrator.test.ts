import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { migrations } from "../src/migrations/index.js";
import { migrationsLoader, MODULE_SCHEMAS } from "../src/migrator.js";

const migrationsDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/migrations",
);

const resolved = Effect.runPromise(migrationsLoader);

describe("migrations", () => {
  // The registry is hand-maintained, so a new migration file that nobody added
  // to it would simply never run. This is the guard against that.
  it("registers exactly the migration files on disk", async () => {
    const onDisk = (await fs.readdir(migrationsDirectory))
      .filter((file) => /^\d+_.+\.ts$/.test(file))
      .map((file) => file.replace(/\.ts$/, ""))
      .sort();
    expect(Object.keys(migrations).sort()).toEqual(onDisk);
  });

  it("resolves every migration, ordered by a contiguous id", async () => {
    const list = await resolved;
    expect(list.map(([id]) => id)).toEqual(
      Array.from({ length: list.length }, (_, index) => index + 1),
    );
    expect(list.map(([, name]) => name).slice(0, 2)).toEqual([
      "create_schema_user",
      "create_schema_organization",
    ]);
  });

  it("exports an Effect from every migration", async () => {
    const list = await resolved;
    for (const [id, name, load] of list) {
      // `ResolvedMigration` widens every loader's requirements to SqlClient;
      // `fromRecord` just hands back the value, so nothing is required here.
      const migration = await Effect.runPromise(load as Effect.Effect<unknown, unknown, never>);
      expect(Effect.isEffect(migration), `${id}_${name} must export an Effect`).toBe(true);
    }
  });

  it("creates a schema for every module that owns one", async () => {
    const names = (await resolved).map(([, name]) => name);
    for (const schema of MODULE_SCHEMAS) {
      expect(names).toContain(`create_schema_${schema}`);
    }
  });
});
