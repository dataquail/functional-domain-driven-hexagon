import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";

import { completeEndpoint } from "./complete.endpoint.ts";
import { createEndpoint } from "./create.endpoint.ts";
import { listEndpoint } from "./list.endpoint.ts";
import { removeEndpoint } from "./remove.endpoint.ts";

// Registers the CLI-facing todos endpoints (the `cliTodos` group on CliApi).
// Sibling to `interface/http/todos-live.ts`; both dispatch to the same bus.
export const TodosCliLive = HttpApiBuilder.group(Api, "cliTodos", (handlers) =>
  handlers
    .handle("list", listEndpoint)
    .handle("create", createEndpoint)
    .handle("complete", completeEndpoint)
    .handle("remove", removeEndpoint),
);
