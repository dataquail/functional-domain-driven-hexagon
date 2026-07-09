import * as HttpApi from "effect/unstable/httpapi/HttpApi";

import * as CliAuthContract from "./api/CliAuthContract.js";
import * as CliOrganizationContract from "./api/CliOrganizationContract.js";
import * as CliTodosContract from "./api/CliTodosContract.js";

// The CLI/MCP wire surface, decoupled from the GUI's `DomainApi` (ADR-0005).
// Served by the same server under a `/cli` prefix; its endpoint adapters live
// in each module's `interface/cli/` and dispatch to the same command/query
// bus handlers the GUI's `interface/http/` adapters use.
export class CliApi extends HttpApi.make("cli")
  .add(CliAuthContract.DeviceGroup)
  .add(CliOrganizationContract.Group)
  .add(CliTodosContract.Group) {}
