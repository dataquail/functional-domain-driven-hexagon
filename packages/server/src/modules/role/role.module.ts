import * as Layer from "effect/Layer";

import { RoleCommandsLive } from "./role.command-handlers";
import { RoleQueriesLive } from "./role.query-handlers";

export const RoleModule = {
  layer: Layer.mergeAll(RoleCommandsLive, RoleQueriesLive),
};
