import * as Layer from "effect/Layer";

import { TodosRepositoryLive } from "./infrastructure/todos-repository-live.js";
import { TodosCliLive } from "./interface/cli/todos-cli-live.js";
import { TodosLive } from "./interface/http/todos-live.js";

// Both inbound adapters (GUI HTTP + CLI) dispatch to the same bus; the
// module wires both groups and the repository they share (ADR-0024).
export const TodosModuleLive = Layer.mergeAll(TodosLive, TodosCliLive).pipe(
  Layer.provide(TodosRepositoryLive),
);
