import { Api } from "@/api.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import { SseContract } from "@org/domain/api/Contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SseManager } from "../sse/sse-manager.js";
import { TodosRepository } from "./todos-repository.js";

export const TodosLive = HttpApiBuilder.group(
  Api,
  "todos",
  Effect.fnUntraced(function* (handlers) {
    const repository = yield* TodosRepository;
    const sseManager = yield* SseManager;

    return handlers
      .handle("get", () => repository.findAll().pipe(Effect.withSpan("TodosLive.get")))
      .handle("create", (request) =>
        repository
          .create({
            completed: false,
            title: request.payload.title,
          })
          .pipe(
            Effect.tap((todo) =>
              sseManager.notifyCurrentUser(
                new SseContract.Todos.UpsertedTodo({
                  todo,
                  optimisticId: request.payload.optimisticId,
                }),
              ),
            ),
            Effect.withSpan("TodosLive.create"),
          ),
      )
      .handle("update", (request) =>
        repository.update(request.payload).pipe(
          Effect.tap((todo) =>
            sseManager.notifyCurrentUser(new SseContract.Todos.UpsertedTodo({ todo })),
          ),
          Effect.withSpan("TodosLive.update"),
        ),
      )
      .handle("delete", (request) =>
        repository.del(request.payload).pipe(
          Effect.tap((todo) =>
            sseManager.notifyCurrentUser(new SseContract.Todos.DeletedTodo({ id: todo.id })),
          ),
          Effect.withSpan("TodosLive.delete"),
        ),
      );
  }),
).pipe(Layer.provide([TodosRepository.Default, SseManager.Default]));
