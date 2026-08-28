import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { fromSqlDirectory, MIGRATIONS_DIRECTORY } from "../src/migrations.js";

const loadFrom = (directory: string) =>
  Effect.runPromise(fromSqlDirectory(directory).pipe(Effect.provide(NodeFileSystem.layer)));

const withDirectory = async <A>(
  files: Record<string, string>,
  use: (directory: string) => Promise<A>,
): Promise<A> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "migrations-"));
  try {
    for (const [name, body] of Object.entries(files)) {
      await fs.writeFile(path.join(directory, name), body);
    }
    return await use(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
};

describe("fromSqlDirectory", () => {
  it("parses Flyway names into ids and orders numerically, not lexically", async () => {
    const resolved = await withDirectory(
      {
        "V002__create_table_users.sql": "SELECT 2",
        "V010__add_index.sql": "SELECT 10",
        "V001__create_schema_user.sql": "SELECT 1",
      },
      loadFrom,
    );
    expect(resolved.map(([id, name]) => [id, name])).toEqual([
      [1, "create_schema_user"],
      [2, "create_table_users"],
      [10, "add_index"],
    ]);
  });

  it("ignores files that are not Flyway-named migrations", async () => {
    const resolved = await withDirectory(
      {
        "V001__create_schema_user.sql": "SELECT 1",
        "README.md": "not a migration",
        "rollback.sql": "not a migration",
        "U001__undo.sql": "not a migration",
      },
      loadFrom,
    );
    expect(resolved.map(([, name]) => name)).toEqual(["create_schema_user"]);
  });

  it("loads every migration this repo ships", async () => {
    const resolved = await loadFrom(MIGRATIONS_DIRECTORY);
    expect(resolved.length).toBe(22);
    expect(resolved.map(([id]) => id)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(resolved.map(([, name]) => name).slice(0, 2)).toEqual([
      "create_schema_user",
      "create_schema_organization",
    ]);
  });
});
