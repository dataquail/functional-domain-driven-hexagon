import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todos.repository.js";
import { TodoNotFound } from "@/modules/todos/domain/todo.errors.js";
import { TodoId } from "@/modules/todos/domain/todo.id.js";
import { TodoRootOps } from "@/modules/todos/domain/todo.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodosRepositoryFake } from "./todos.repository-fake.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const orgId = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherOrgId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.makeUnsafe(new Date("2025-02-01T00:00:00Z"));

const buyMilk = TodoRootOps.create({ id: aliceId, organizationId: orgId, title: "Buy milk", now });

const provide = Effect.provide(TodosRepositoryFake);

describe("TodosRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores the todo and makes it findable by (org, id)", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insertOne(buyMilk);
        const found = yield* repo.findOneById(orgId, buyMilk.id);
        deepStrictEqual(found.id, buyMilk.id);
        deepStrictEqual(found.organizationId, orgId);
        deepStrictEqual(found.title, buyMilk.title);
        deepStrictEqual(found.completed, false);
      }).pipe(provide),
    );
  });

  describe("findOneById", () => {
    it.effect("fails TodoNotFound for an unknown id", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.findOneById(orgId, bobId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(provide),
    );

    it.effect("fails TodoNotFound when the id exists but in another org (isolation)", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insertOne(buyMilk);
        const exit = yield* Effect.exit(repo.findOneById(otherOrgId, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(provide),
    );
  });

  describe("update", () => {
    it.effect("overwrites the stored todo", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insertOne(buyMilk);
        const completed = TodoRootOps.update(buyMilk, {
          title: buyMilk.title,
          completed: true,
          now: later,
        });
        yield* repo.updateOne(completed);
        const found = yield* repo.findOneById(orgId, buyMilk.id);
        deepStrictEqual(found.completed, true);
        deepStrictEqual(found.updatedAt, later);
      }).pipe(provide),
    );

    it.effect("fails TodoNotFound when the todo isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.updateOne(buyMilk));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(provide),
    );
  });

  describe("remove", () => {
    it.effect("removes the todo", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insertOne(buyMilk);
        yield* repo.deleteOne(orgId, buyMilk.id);
        const exit = yield* Effect.exit(repo.findOneById(orgId, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
      }).pipe(provide),
    );

    it.effect("fails TodoNotFound when the todo isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        const exit = yield* Effect.exit(repo.deleteOne(orgId, bobId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
          deepStrictEqual(error instanceof TodoNotFound, true);
        }
      }).pipe(provide),
    );

    it.effect("fails TodoNotFound when removing from the wrong org (isolation)", () =>
      Effect.gen(function* () {
        const repo = yield* TodosRepository;
        yield* repo.insertOne(buyMilk);
        const exit = yield* Effect.exit(repo.deleteOne(otherOrgId, buyMilk.id));
        deepStrictEqual(Exit.isFailure(exit), true);
        // Row still present under its real org.
        const found = yield* repo.findOneById(orgId, buyMilk.id);
        deepStrictEqual(found.id, buyMilk.id);
      }).pipe(provide),
    );
  });
});
