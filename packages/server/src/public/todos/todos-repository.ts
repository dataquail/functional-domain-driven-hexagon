import { TodosContract } from "@org/contracts/api/Contracts";
import { TodoId } from "@org/contracts/EntityIds";
import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import type { ParseError } from "effect/ParseResult";
import * as Schema from "effect/Schema";

const toContract = (row: RowSchemas.TodoRow): Effect.Effect<TodosContract.Todo, ParseError> =>
  Schema.decode(TodosContract.Todo)({
    id: row.id,
    title: row.title,
    completed: row.completed,
  });

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
        execute((client) =>
          client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
            INSERT INTO todos (title, completed)
            VALUES (${input.title}, ${input.completed})
            RETURNING *
          `),
        ).pipe(
          Effect.flatMap(
            (row): Effect.Effect<TodosContract.Todo, ParseError> =>
              row === null ? Effect.dieMessage("INSERT did not return a row") : toContract(row),
          ),
          Effect.catchTags({
            DatabaseError: Effect.die,
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
          client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
            UPDATE todos
            SET title = ${input.title}, completed = ${input.completed}
            WHERE id = ${input.id}
            RETURNING *
          `),
        ).pipe(
          Effect.flatMap(
            (
              row,
            ): Effect.Effect<TodosContract.Todo, ParseError | TodosContract.TodoNotFoundError> =>
              row === null
                ? Effect.fail(
                    new TodosContract.TodoNotFoundError({
                      message: `Todo with id ${input.id} not found`,
                    }),
                  )
                : toContract(row),
          ),
          Effect.catchTags({
            DatabaseError: Effect.die,
            ParseError: Effect.die,
          }),
          Effect.withSpan("TodosRepository.update"),
        ),
    );

    const findAll = db.makeQuery((execute) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.TodoRowStd)`
          SELECT * FROM todos ORDER BY created_at DESC
        `),
      ).pipe(
        Effect.flatMap((rows) => Effect.forEach(rows, toContract)),
        Effect.map((todos) => todos as ReadonlyArray<TodosContract.Todo>),
        Effect.catchTags({
          DatabaseError: Effect.die,
          ParseError: Effect.die,
        }),
        Effect.withSpan("TodosRepository.findAll"),
      ),
    );

    const del = db.makeQuery((execute, input: TodoId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.TodoRowStd)`
          DELETE FROM todos WHERE id = ${input} RETURNING *
        `),
      ).pipe(
        Effect.flatMap(
          (row): Effect.Effect<{ readonly id: TodoId }, TodosContract.TodoNotFoundError> =>
            row === null
              ? Effect.fail(
                  new TodosContract.TodoNotFoundError({
                    message: `Todo with id ${input} not found`,
                  }),
                )
              : Effect.succeed({ id: TodoId.make(row.id) }),
        ),
        Effect.catchTags({
          DatabaseError: Effect.die,
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
