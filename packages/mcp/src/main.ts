#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { makeCliClient, readCredentials, resolveBaseUrl, resolveToken } from "@org/api-client";
import { CliOrganizationContract, CliTodosContract } from "@org/contracts/api/Contracts";
import { OrganizationId, TodoId } from "@org/contracts/EntityIds";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { z } from "zod";

// MCP (stdio) server exposing the CLI surface as tools (ADR-0005). It reuses
// `@org/api-client` over `CliApi`, so the MCP tools and the CLI run the exact
// same authenticated requests. Auth comes from `APP_API_TOKEN` or the stored
// credential (resolved per call). stdout is the JSON-RPC channel — all
// diagnostics go to stderr only.

type CliClient = Effect.Success<ReturnType<typeof makeCliClient>>;

// Every failure a CLI client call can raise is a tagged error with a message.
type ToolFailure = { readonly _tag: string; readonly message: string };

const textResult = (text: string) => ({ content: [{ type: "text" as const, text }] });

type ToolResult = ReturnType<typeof textResult> & { readonly isError?: boolean };

const errorResult = (message: string): ToolResult => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

const jsonResult =
  <S extends Schema.Top>(schema: S) =>
  (value: S["Type"]) =>
    Schema.encodeEffect(Schema.fromJsonString(schema, { space: 2 }))(value).pipe(
      Effect.map(textResult),
    );

const messageOr = (message: string, fallback: string): string =>
  Option.liftPredicate(message, (text) => text.length > 0).pipe(Option.getOrElse(() => fallback));

const friendlyError = (error: ToolFailure, baseUrl: string): string =>
  Match.value(error._tag).pipe(
    Match.when("Unauthorized", () => "Not authorized — the token is invalid or expired."),
    Match.when("Forbidden", () => "No access to that organization or resource."),
    Match.when("ServiceUnavailable", () => "The server is temporarily unavailable."),
    Match.when("CliTodoNotFoundError", () => messageOr(error.message, "Todo not found.")),
    Match.when("HttpClientError", () => `Could not reach the server at ${baseUrl}.`),
    Match.orElse((tag) => `Request failed (${tag}).`),
  );

// Resolves the token, builds the client, runs `body`, and folds every failure
// into an MCP result so the tool handler never rejects. Defects (unexpected)
// become an error result rather than a crash.
const callTool = <A, E extends ToolFailure, R>(
  body: (client: CliClient) => Effect.Effect<A, E, never>,
  format: (value: A) => Effect.Effect<ToolResult, E | Schema.SchemaError, R>,
) =>
  Effect.gen(function* () {
    const creds = yield* readCredentials;
    const token = yield* resolveToken(creds);

    if (Option.isNone(token)) {
      return errorResult(
        "Not authenticated. Set APP_API_TOKEN, or run `org auth login` with the CLI.",
      );
    }

    const baseUrl = yield* resolveBaseUrl;
    const client = yield* makeCliClient({ baseUrl, token });
    const value = yield* body(client);

    return yield* format(value);
  }).pipe(
    Effect.catch((error) =>
      Effect.map(resolveBaseUrl, (baseUrl) => errorResult(friendlyError(error, baseUrl))),
    ),
    Effect.catchDefect((defect) =>
      Effect.succeed(errorResult(`Unexpected failure: ${String(defect)}`)),
    ),
  );

const runtime = ManagedRuntime.make(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer));

// The MCP SDK hands each tool handler a promise contract.
const dispatch = (
  effect: Effect.Effect<ToolResult, never, ManagedRuntime.ManagedRuntime.Services<typeof runtime>>,
) => runtime.runPromise(effect);

const server = new McpServer({ name: "org-mcp", version: "0.0.0" });

server.registerTool(
  "list_organizations",
  {
    title: "List organizations",
    description: "List the organizations the authenticated user belongs to.",
  },
  () =>
    dispatch(
      callTool(
        (client) => client.cliOrganization.listMine(),
        jsonResult(Schema.Array(CliOrganizationContract.CliOrganization)),
      ),
    ),
);

server.registerTool(
  "list_todos",
  {
    title: "List todos",
    description: "List the todos in an organization.",
    inputSchema: { orgId: z.string().describe("Organization id") },
  },
  ({ orgId }) =>
    dispatch(
      callTool(
        (client) => client.cliTodos.list({ params: { orgId: OrganizationId.make(orgId) } }),
        jsonResult(Schema.Array(CliTodosContract.CliTodo)),
      ),
    ),
);

server.registerTool(
  "create_todo",
  {
    title: "Create todo",
    description: "Create a todo in an organization.",
    inputSchema: {
      orgId: z.string().describe("Organization id"),
      title: z.string().min(1).describe("Todo title"),
    },
  },
  ({ orgId, title }) =>
    dispatch(
      callTool(
        (client) =>
          client.cliTodos.create({
            params: { orgId: OrganizationId.make(orgId) },
            payload: new CliTodosContract.CliCreateTodoPayload({ title }),
          }),
        jsonResult(CliTodosContract.CliTodo),
      ),
    ),
);

server.registerTool(
  "complete_todo",
  {
    title: "Complete todo",
    description: "Mark a todo as done.",
    inputSchema: {
      orgId: z.string().describe("Organization id"),
      todoId: z.string().describe("Todo id"),
    },
  },
  ({ orgId, todoId }) =>
    dispatch(
      callTool(
        (client) =>
          client.cliTodos.complete({
            params: { orgId: OrganizationId.make(orgId), id: TodoId.make(todoId) },
          }),
        jsonResult(CliTodosContract.CliTodo),
      ),
    ),
);

server.registerTool(
  "remove_todo",
  {
    title: "Remove todo",
    description: "Delete a todo from an organization.",
    inputSchema: {
      orgId: z.string().describe("Organization id"),
      todoId: z.string().describe("Todo id"),
    },
  },
  ({ orgId, todoId }) =>
    dispatch(
      callTool(
        (client) =>
          client.cliTodos.remove({
            params: { orgId: OrganizationId.make(orgId), id: TodoId.make(todoId) },
          }),
        () => Effect.succeed(textResult(`Removed todo ${todoId}.`)),
      ),
    ),
);

// stderr only — stdout is the JSON-RPC protocol channel.
const main = Effect.tryPromise(() => server.connect(new StdioServerTransport())).pipe(
  Effect.andThen(Console.error("org-mcp: ready on stdio")),
  Effect.tapCause((cause) => Console.error(`org-mcp: fatal ${Cause.pretty(cause)}`)),
);

NodeRuntime.runMain(main, { disableErrorReporting: true });
