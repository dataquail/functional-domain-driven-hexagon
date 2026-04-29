import * as Layer from "effect/Layer";
import { TodosNotifierLive } from "./infrastructure/todos-notifier-live.js";
import { TodosRepositoryLive } from "./infrastructure/todos-repository-live.js";
import { TodosHttpLive } from "./interface/todos-http-live.js";

export const TodosModuleLive = TodosHttpLive.pipe(
  Layer.provide([TodosRepositoryLive, TodosNotifierLive]),
);
