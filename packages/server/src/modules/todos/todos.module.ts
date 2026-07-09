import * as Layer from "effect/Layer";

import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live.js";
import { TodosCliLive } from "./interface/cli/index.js";
import { TodosLive } from "./interface/http/index.js";

// Both inbound adapters (GUI HTTP + CLI) dispatch to the same bus; the
// module wires both groups and the repository they share (ADR-0005).
export const TodosModuleLive = Layer.mergeAll(TodosLive, TodosCliLive).pipe(
  Layer.provide(TodosRepositoryLive),
);
