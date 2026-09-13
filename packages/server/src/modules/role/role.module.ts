import * as Layer from "effect/Layer";

import { RoleCommandsLive } from "./role.command-handlers.js";
import { RoleQueriesLive } from "./role.query-handlers.js";

export const RoleModule = {
  layer: Layer.mergeAll(RoleCommandsLive, RoleQueriesLive),
};
