import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import { CliApi } from "@org/contracts/CliApi";
import { DomainApi } from "@org/contracts/DomainApi";

// Two API products on one server (ADR-0024): the GUI BFF (`DomainApi`) and
// the CLI/MCP surface (`CliApi`, under `/cli`). Distinct group names + path
// prefixes, so they compose without collision.
export const Api = HttpApi.make("api").addHttpApi(DomainApi).addHttpApi(CliApi);
