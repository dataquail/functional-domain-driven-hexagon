import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { TodoRootOps } from "@/modules/todos/domain/todo.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const todoId = TodoId.make("todo-1");
const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));

const fresh = () => TodoRootOps.create({ id: todoId, organizationId, title: "Buy milk", now });

describe("TodoRootOps.create", () => {
  it("constructs an incomplete todo with the given id/title/org and timestamps", () => {
    const todo = fresh();
    deepStrictEqual(todo.id, todoId);
    deepStrictEqual(todo.organizationId, organizationId);
    deepStrictEqual(todo.title, "Buy milk");
    deepStrictEqual(todo.completed, false);
    deepStrictEqual(todo.createdAt, now);
    deepStrictEqual(todo.updatedAt, now);
  });
});

describe("TodoRootOps.update", () => {
  it("replaces title/completed and advances updatedAt, preserving id/org/createdAt", () => {
    const updated = TodoRootOps.update(fresh(), {
      title: "Buy oat milk",
      completed: true,
      now: later,
    });
    deepStrictEqual(updated.id, todoId);
    deepStrictEqual(updated.organizationId, organizationId);
    deepStrictEqual(updated.title, "Buy oat milk");
    deepStrictEqual(updated.completed, true);
    deepStrictEqual(updated.createdAt, now);
    deepStrictEqual(updated.updatedAt, later);
  });
});

describe("TodoRootOps.complete", () => {
  it("flips completed to true and re-stamps updatedAt without touching the title", () => {
    const completed = TodoRootOps.complete(fresh(), later);
    deepStrictEqual(completed.completed, true);
    deepStrictEqual(completed.title, "Buy milk");
    deepStrictEqual(completed.updatedAt, later);
  });

  it("is idempotent: completing an already-done todo just re-stamps updatedAt", () => {
    const once = TodoRootOps.complete(fresh(), now);
    const twice = TodoRootOps.complete(once, later);
    deepStrictEqual(twice.completed, true);
    deepStrictEqual(twice.updatedAt, later);
  });
});

describe("Todo aggregate purity", () => {
  it("update/complete return new instances without mutating the input", () => {
    const todo = fresh();
    TodoRootOps.update(todo, { title: "changed", completed: true, now: later });
    TodoRootOps.complete(todo, later);
    deepStrictEqual(todo.title, "Buy milk");
    deepStrictEqual(todo.completed, false);
  });
});
