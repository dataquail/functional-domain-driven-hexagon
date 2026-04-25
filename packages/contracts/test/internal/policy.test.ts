import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as internal from "../../src/internal/policy.js";

describe("makePermissions", () => {
  it("generates correct permission strings for actions", () => {
    const permissions = internal.makePermissions({
      users: ["read", "manage"],
    });

    deepStrictEqual(permissions, ["users:read", "users:manage"]);
  });

  it("handles multiple domains", () => {
    const permissions = internal.makePermissions({
      users: ["read"],
      posts: ["manage"],
    });

    deepStrictEqual(permissions, ["users:read", "posts:manage"]);
  });

  it("handles empty arrays", () => {
    const permissions = internal.makePermissions({
      users: [],
    });

    deepStrictEqual(permissions, []);
  });
});
