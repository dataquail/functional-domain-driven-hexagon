import * as Layer from "effect/Layer";

import { RoleCommandsLive } from "./role.command-handlers.ts";
import { RoleQueriesLive } from "./role.query-handlers.ts";

export const RoleModule = {
  layer: Layer.mergeAll(RoleCommandsLive, RoleQueriesLive),
};
