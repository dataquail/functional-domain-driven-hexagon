import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { Api } from "@/api.js";

import { findMineEndpoint } from "./find-mine.endpoint.js";

// Registers the CLI-facing organization endpoints (the `cliOrganization`
// group on CliApi). Sibling to the HTTP org group; dispatches to the same bus.
export const OrgCliLive = HttpApiBuilder.group(Api, "cliOrganization", (handlers) =>
  handlers.handle("listMine", findMineEndpoint),
);
