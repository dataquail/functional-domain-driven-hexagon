import * as Layer from "effect/Layer";
import { TodosRepositoryLive } from "./infrastructure/todos-repository-live.js";
import { TodosLive } from "./interface/http/todos-live.js";

export const TodosModuleLive = TodosLive.pipe(Layer.provide(TodosRepositoryLive));
