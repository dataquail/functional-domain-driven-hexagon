#!/usr/bin/env node
import * as NodeServices from "@effect/platform-node/NodeServices";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { makeCliClient, readCredentials, resolveBaseUrl, resolveToken } from "@org/api-client";
import { OrganizationId, TodoId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { z } from "zod";

// MCP (stdio) server exposing the CLI surface as tools (ADR-0005). It reuses
// `@org/api-client` over `CliApi`, so the MCP tools and the CLI run the exact
// same authenticated requests. Auth comes from `APP_API_TOKEN` or the stored
// credential (resolved per call). stdout is the JSON-RPC channel — all
// diagnostics go to stderr only.

type CliClient = Effect.Success<ReturnType<typeof makeCliClient>>;

type ToolOutcome<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly message: string };

const friendlyError = (error: unknown): string => {
  const tag =
    typeof error === "object" && error !== null && "_tag" in error
      ? String((error as { readonly _tag: unknown })._tag)
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { readonly message: unknown }).message)
      : "";
  switch (tag) {
    case "Unauthorized":
      return "Not authorized — the token is invalid or expired.";
    case "Forbidden":
      return "No access to that organization or resource.";
    case "ServiceUnavailable":
      return "The server is temporarily unavailable.";
    case "CliTodoNotFoundError":
      return message.length > 0 ? message : "Todo not found.";
    case "RequestError":
    case "ResponseError":
      return `Could not reach the server at ${resolveBaseUrl()}.`;
    default:
      return tag.length > 0
        ? `Request failed (${tag}).`
        : message.length > 0
          ? message
          : String(error);
  }
};

// Resolves the token, builds the client, runs `body`, and folds every failure
// into a friendly outcome so the tool handler never rejects on expected errors.
const callTool = <A>(body: (client: CliClient) => Effect.Effect<A, unknown, never>) =>
  Effect.gen(function* () {
    const creds = yield* readCredentials;
    const token = resolveToken(creds);
    if (token === null) {
      return {
        ok: false as const,
        message: "Not authenticated. Set APP_API_TOKEN, or run `org auth login` with the CLI.",
      };
    }
    const client = yield* makeCliClient({ baseUrl: resolveBaseUrl(), token });
    const value = yield* body(client);
    return { ok: true as const, value };
  }).pipe(
    Effect.catch((error) => Effect.succeed({ ok: false as const, message: friendlyError(error) })),
  );

const runtime = ManagedRuntime.make(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer));

const textResult = (text: string) => ({ content: [{ type: "text" as const, text }] });
const errorResult = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});
const jsonResult = (data: unknown) => textResult(JSON.stringify(data, null, 2));

// Runs a tool effect through the shared runtime, mapping the outcome to an
// MCP result. Defects (unexpected) become an error result rather than a crash.
const dispatch = async <A>(
  effect: Effect.Effect<
    ToolOutcome<A>,
    never,
    ManagedRuntime.ManagedRuntime.Services<typeof runtime>
  >,
  format: (value: A) => ReturnType<typeof textResult>,
) => {
  try {
    const outcome = await runtime.runPromise(effect);
    return outcome.ok ? format(outcome.value) : errorResult(outcome.message);
  } catch (error) {
    return errorResult(friendlyError(error));
  }
};

const server = new McpServer({ name: "org-mcp", version: "0.0.0" });

server.registerTool(
  "list_organizations",
  {
    title: "List organizations",
    description: "List the organizations the authenticated user belongs to.",
  },
  () =>
    dispatch(
      callTool((client) => client.cliOrganization.listMine()),
      jsonResult,
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
      callTool((client) => client.cliTodos.list({ params: { orgId: OrganizationId.make(orgId) } })),
      jsonResult,
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
      callTool((client) =>
        client.cliTodos.create({
          params: { orgId: OrganizationId.make(orgId) },
          payload: { title },
        }),
      ),
      jsonResult,
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
      callTool((client) =>
        client.cliTodos.complete({
          params: { orgId: OrganizationId.make(orgId), id: TodoId.make(todoId) },
        }),
      ),
      jsonResult,
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
      callTool((client) =>
        client.cliTodos.remove({
          params: { orgId: OrganizationId.make(orgId), id: TodoId.make(todoId) },
        }),
      ),
      () => textResult(`Removed todo ${todoId}.`),
    ),
);

async function main() {
  await server.connect(new StdioServerTransport());
  // stderr only — stdout is the JSON-RPC protocol channel.
  process.stderr.write("org-mcp: ready on stdio\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`org-mcp: fatal ${String(error)}\n`);
  process.exit(1);
});
