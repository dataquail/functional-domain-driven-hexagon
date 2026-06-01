import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodosRepository } from "../domain/ports/repositories/todo-repository.js";
import * as Todo from "../domain/todo.js";
import { TodoNotFound } from "../domain/todo-errors.js";
import { TodosRepositoryFake } from "./todos-repository-fake.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const orgId = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherOrgId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));

const buyMilk = Todo.create({ id: aliceId, organizationId: orgId, title: "Buy milk", now });

const provide = Effect.provide(TodosRepositoryFake);

describe("TodosRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores the todo and makes it findable by (org, id)", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        const found = yield* repo.findById(orgId, buyMilk.id);
        deepStrictEqual(found.id, buyMilk.id);
        deepStrictEqual(found.organizationId, orgId);
        deepStrictEqual(found.title, buyMilk.title);
        deepStrictEqual(found.completed, false);
      }).pipe(provide),
    );
  });

  describe("findById", () => {
    it.effect("fails TodoNotFound for an unknown id", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.findById(orgId, bobId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(provide),
    );

    it.effect("fails TodoNotFound when the id exists but in another org (isolation)", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        const exit = yield* Effect.exit(repo.findById(otherOrgId, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(provide),
    );
  });

  describe("update", () => {
    it.effect("overwrites the stored todo", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        const completed = Todo.update(buyMilk, {
          title: buyMilk.title,
          completed: true,
          now: later,
        });
        yield* repo.update(completed);
        const found = yield* repo.findById(orgId, buyMilk.id);
        deepStrictEqual(found.completed, true);
        deepStrictEqual(found.updatedAt, later);
      }).pipe(provide),
    );

    it.effect("fails TodoNotFound when the todo isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.update(buyMilk));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(provide),
    );
  });

  describe("remove", () => {
    it.effect("removes the todo", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        yield* repo.remove(orgId, buyMilk.id);
        const exit = yield* Effect.exit(repo.findById(orgId, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
      }).pipe(provide),
    );

    it.effect("fails TodoNotFound when the todo isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.remove(orgId, bobId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(provide),
    );

    it.effect("fails TodoNotFound when removing from the wrong org (isolation)", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insert(buyMilk);
        const exit = yield* Effect.exit(repo.remove(otherOrgId, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
        // Row still present under its real org.
        const found = yield* repo.findById(orgId, buyMilk.id);
        deepStrictEqual(found.id, buyMilk.id);
      }).pipe(provide),
    );
  });
});
