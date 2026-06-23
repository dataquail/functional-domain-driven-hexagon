import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";

import { Api } from "@/api.js";

import { completeEndpoint } from "./complete.endpoint.js";
import { createEndpoint } from "./create.endpoint.js";
import { listEndpoint } from "./list.endpoint.js";
import { removeEndpoint } from "./remove.endpoint.js";

// Registers the CLI-facing todos endpoints (the `cliTodos` group on CliApi).
// Sibling to `interface/http/todos-live.ts`; both dispatch to the same bus.
export const TodosCliLive = HttpApiBuilder.group(Api, "cliTodos", (handlers) =>
  handlers
    .handle("list", listEndpoint)
    .handle("create", createEndpoint)
    .handle("complete", completeEndpoint)
    .handle("remove", removeEndpoint),
);
