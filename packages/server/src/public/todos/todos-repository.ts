import { Database, DbSchema } from "@org/database/index";
import { TodosContract } from "@org/domain/api/Contracts";
import { TodoId } from "@org/domain/EntityIds";
import * as d from "drizzle-orm";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class TodosRepository extends Effect.Service<TodosRepository>()("TodosRepository", {
  effect: Effect.gen(function* () {
    const db = yield* Database.Database;

    const create = db.makeQuery(
      (
        execute,
        input: {
          title: string;
          completed: boolean;
        },
      ) =>
        execute((client) => client.insert(DbSchema.todosTable).values(input).returning()).pipe(
          Effect.flatMap(Array.head),
          Effect.flatMap(Schema.decode(TodosContract.Todo)),
          Effect.catchTags({
            DatabaseError: Effect.die,
            NoSuchElementException: () => Effect.dieMessage(""),
            ParseError: Effect.die,
          }),
          Effect.withSpan("TodosRepository.create"),
        ),
    );

    const update = db.makeQuery(
      (
        execute,
        input: {
          id: string;
          title: string;
          completed: boolean;
        },
      ) =>
        execute((client) =>
          client
            .update(DbSchema.todosTable)
            .set(input)
            .where(d.eq(DbSchema.todosTable.id, input.id))
            .returning(),
        ).pipe(
          Effect.flatMap(Array.head),
          Effect.flatMap(Schema.decode(TodosContract.Todo)),
          Effect.catchTags({
            DatabaseError: Effect.die,
            NoSuchElementException: () =>
              new TodosContract.TodoNotFoundError({
                message: `Todo with id ${input.id} not found`,
              }),
            ParseError: Effect.die,
          }),
          Effect.withSpan("TodosRepository.update"),
        ),
    );

    const findAll = db.makeQuery((execute) =>
      execute((client) =>
        client.query.todosTable.findMany({
          orderBy: (todos, { desc }) => [desc(todos.createdAt)],
        }),
      ).pipe(
        Effect.flatMap(Schema.decode(Schema.Array(TodosContract.Todo))),
        Effect.catchTags({
          DatabaseError: Effect.die,
          ParseError: Effect.die,
        }),
        Effect.withSpan("TodosRepository.findAll"),
      ),
    );

    const del = db.makeQuery((execute, input: TodoId) =>
      execute((client) =>
        client
          .delete(DbSchema.todosTable)
          .where(d.eq(DbSchema.todosTable.id, input))
          .returning({ id: DbSchema.todosTable.id }),
      ).pipe(
        Effect.flatMap(Array.head),
        Effect.flatMap(Schema.decode(Schema.Struct({ id: TodoId }))),
        Effect.catchTags({
          DatabaseError: Effect.die,
          NoSuchElementException: () =>
            new TodosContract.TodoNotFoundError({
              message: `Todo with id ${input} not found`,
            }),
          ParseError: Effect.die,
        }),
        Effect.withSpan("TodosRepository.del"),
      ),
    );

    return {
      create,
      del,
      findAll,
      update,
    };
  }),
}) {}
