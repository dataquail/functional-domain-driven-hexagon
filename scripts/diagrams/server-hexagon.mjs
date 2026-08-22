import { isMain, runGenerator } from "../lib/diagram/generator.mjs";
import { addEdge, addNode, makeGraph } from "../lib/diagram/graph.mjs";
import { readServerModel } from "../lib/diagram/server-model.mjs";

const COLUMNS = {
  driving: "1 · driving adapters",
  authorization: "2 · authorization",
  messages: "3 · messages (CQRS bus)",
  useCases: "4 · use cases",
  events: "5 · domain events",
  ports: "6 · the boundary: port ← adapters",
  driven: "7 · driven adapters",
  outside: "8 · outside the hexagon",
};

const readable = (tag) => tag.replace(/(Command|Query)$/, "");

const build = (cli) => {
  const { modules, ownerOfCommand } = readServerModel();
  const only = cli.flag("module");
  const selected = only === undefined ? undefined : new Set(only.split(","));

  return [...modules.values()]
    .filter((module) => selected === undefined || selected.has(module.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((module) => {
      const graph = makeGraph({
        slug: `server-hexagon-${module.name}`,
        title: `modules/${module.name} — ports and adapters`,
        direction: "LR",
      });

      const boundary = (port) => `${COLUMNS.ports}/${port}`;

      const messageNode = (tag) => {
        const owner = ownerOfCommand.get(tag) ?? module.name;
        const isQuery = module.queries.has(tag);
        addNode(graph, {
          id: `msg:${tag}`,
          label: owner === module.name ? readable(tag) : `${readable(tag)}<br/>(${owner})`,
          kind: isQuery ? "query" : "message",
          group: COLUMNS.messages,
        });
        return `msg:${tag}`;
      };

      // Every guard resolves through one registry, and the registry closes over
      // the ports and queries below — per-action edges would invent specificity
      // the contribution does not have.
      const registryNode = () => {
        const id = "authz:registry";
        addNode(graph, {
          id,
          label: `policies/<br/>${module.checks.size} check${module.checks.size === 1 ? "" : "s"}`,
          kind: "policy",
          group: COLUMNS.authorization,
        });
        for (const port of module.policyPorts) {
          addNode(graph, { id: `port:${port}`, label: port, kind: "port", group: boundary(port) });
          addEdge(graph, { from: id, to: `port:${port}`, label: "consults" });
        }
        for (const tag of module.policyQueries) {
          addEdge(graph, { from: id, to: messageNode(tag), label: "asks" });
        }
        return id;
      };

      for (const endpoint of module.endpoints) {
        const id = `in:${endpoint.span}`;
        addNode(graph, {
          id,
          label:
            endpoint.route === undefined
              ? `${endpoint.protocol.toUpperCase()}<br/>${endpoint.span}`
              : `${endpoint.route}<br/>${endpoint.span}`,
          kind: "interface",
          group: COLUMNS.driving,
        });

        let from = id;
        for (const policy of endpoint.policies) {
          const resource = module.resources.get(policy.resource) ?? policy.resource;
          const guard = `authz:${resource}.${policy.action}`;
          addNode(graph, {
            id: guard,
            label: `${resource}<br/>${(policy.action ?? "?").toLowerCase()}`,
            kind: "policy",
            group: COLUMNS.authorization,
          });
          addEdge(graph, { from, to: guard, label: "guards" });
          addEdge(graph, { from: guard, to: registryNode(), label: "checked by" });
          from = guard;
        }
        for (const tag of endpoint.dispatches) {
          addEdge(graph, { from, to: messageNode(tag), label: "dispatches" });
        }
      }

      for (const subscription of module.subscriptions) {
        const id = `on:${subscription.event}`;
        addNode(graph, {
          id,
          label: `on ${subscription.event}<br/>${subscription.mode}`,
          kind: "interface",
          group: COLUMNS.driving,
        });
        for (const tag of subscription.dispatches) {
          addEdge(graph, { from: id, to: messageNode(tag), label: "dispatches" });
        }
      }

      for (const [tag, handlerName] of module.bindings) {
        const handler = module.handlers.get(handlerName);
        if (handler === undefined) continue;
        const id = `use:${handlerName}`;
        addNode(graph, {
          id,
          label: handlerName,
          kind: handler.readSide ? "query" : "application",
          group: COLUMNS.useCases,
        });
        addEdge(graph, { from: messageNode(tag), to: id, label: "handled by" });

        for (const port of handler.ports) {
          addNode(graph, {
            id: `port:${port}`,
            label: port,
            kind: "port",
            group: boundary(port),
          });
          addEdge(graph, { from: id, to: `port:${port}`, label: "uses" });
        }

        if (handler.readSide && handler.readsDatabase) {
          addNode(graph, {
            id: "read-model",
            label: "SQL read model<br/>@org/database",
            kind: "infrastructure",
            group: COLUMNS.driven,
          });
          addEdge(graph, { from: id, to: "read-model", label: "reads (no port)" });
        }

        for (const event of handler.events) {
          addNode(graph, {
            id: `event:${event}`,
            label: event,
            kind: "domain",
            group: COLUMNS.events,
          });
          addEdge(graph, { from: id, to: `event:${event}`, label: "emits" });
        }

        for (const dispatched of handler.dispatches) {
          if (dispatched === tag) continue;
          addEdge(graph, { from: id, to: messageNode(dispatched), label: "dispatches" });
        }
      }

      for (const [name, adapter] of module.adapters) {
        if (adapter.kind === "fake" && !cli.has("fakes")) continue;
        const implemented = module.ports.has(adapter.provides);
        addNode(graph, {
          id: `adapter:${name}`,
          label: name,
          kind: "infrastructure",
          group: implemented ? boundary(adapter.provides) : COLUMNS.driven,
        });
        if (implemented) {
          addNode(graph, {
            id: `port:${adapter.provides}`,
            label: adapter.provides,
            kind: "port",
            group: boundary(adapter.provides),
          });
          addEdge(graph, {
            from: `adapter:${name}`,
            to: `port:${adapter.provides}`,
            label: "implements",
            relation: "implements",
          });
        }
        for (const external of [...adapter.externals, ...adapter.tables]) {
          addNode(graph, {
            id: `out:${external}`,
            label: external,
            kind: "external",
            group: COLUMNS.outside,
          });
          addEdge(graph, { from: `adapter:${name}`, to: `out:${external}` });
        }
      }

      const readModel = graph.nodes.get("read-model");
      if (readModel !== undefined) {
        addNode(graph, {
          id: "out:Postgres",
          label: "Postgres",
          kind: "external",
          group: COLUMNS.outside,
        });
        addEdge(graph, { from: "read-model", to: "out:Postgres" });
      }

      return graph;
    })
    .filter((graph) => graph.nodes.size > 0);
};

export const generator = {
  name: "server-hexagon",
  describe:
    "one diagram per server module: driving adapters → messages → use cases → ports ← driven adapters",
  options: `  --module <a,b>        only these modules   [all]
  --fakes               include the *-fake adapters (the test seam on the same port)
`,
  build,
};

if (isMain(import.meta.url)) await runGenerator(generator);
