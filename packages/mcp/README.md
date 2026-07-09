# @org/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server (stdio transport) that exposes the application's CLI surface as tools, so an MCP client (Claude Desktop, IDE agents, etc.) can manage todos and organizations.

It reuses `@org/api-client` over the same `CliApi` the CLI uses (ADR-0010), so MCP tool calls run the exact same authenticated requests as `org …` CLI commands.

## Tools

| Tool                 | Arguments         | Effect                          |
| -------------------- | ----------------- | ------------------------------- |
| `list_organizations` | —                 | List the caller's organizations |
| `list_todos`         | `orgId`           | List an org's todos             |
| `create_todo`        | `orgId`, `title`  | Create a todo                   |
| `complete_todo`      | `orgId`, `todoId` | Mark a todo done                |
| `remove_todo`        | `orgId`, `todoId` | Delete a todo                   |

Expected-error cases (not authorized, todo not found, server unreachable, …) come back as a tool result with `isError: true` and a human-readable message, not a protocol error.

## Authentication

The server resolves a bearer token per call, in order:

1. `APP_API_TOKEN` environment variable (recommended for MCP clients / CI), or
2. the credential file written by `org auth login` (`$XDG_CONFIG_HOME/org-cli/credentials.json`).

`APP_API_URL` selects the server (default `http://localhost:3001`). Mint a token in the web UI (Settings → API tokens) or via the CLI device flow.

## Run

Local/dev (stdio):

```bash
APP_API_TOKEN=pat_… APP_API_URL=https://your-server pnpm -F @org/mcp dev
```

### MCP client launch config

```jsonc
{
  "mcpServers": {
    "org": {
      "command": "pnpm",
      "args": ["-C", "/abs/path/to/repo", "-F", "@org/mcp", "exec", "tsx", "src/main.ts"],
      "env": {
        "APP_API_TOKEN": "pat_…",
        "APP_API_URL": "https://your-server",
      },
    },
  },
}
```

> Note: stdout is the JSON-RPC channel — the server writes all diagnostics to stderr. A published, prebuilt binary entry (`org-mcp`) is a follow-up alongside the workspace's distribution packaging; until then run via `tsx` as above.
