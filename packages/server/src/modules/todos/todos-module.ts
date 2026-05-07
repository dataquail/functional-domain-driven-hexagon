import * as Layer from "effect/Layer";
import { TodosRepositoryLive } from "./infrastructure/todos-repository-live.js";
import { TodosHttpLive } from "./interface/todos-http-live.js";

export const TodosModuleLive = TodosHttpLive.pipe(Layer.provide(TodosRepositoryLive));
