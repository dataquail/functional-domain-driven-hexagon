import { isMain, runGenerator } from "../lib/diagram/generator.mjs";
import { addEdge, addNode, makeGraph } from "../lib/diagram/graph.mjs";
import { readServerModel, useCaseSlug } from "../lib/diagram/server-model.mjs";

// Dependency points inward, so the lanes run outward → inward, left → right.
// This is the map, not the territory: no adapters, no handlers, no guards —
// click a use case for those. Every node here is something a reader would name
// when describing the module out loud.
const INTERFACE = "1 · interface";
const APPLICATION = "2 · use cases";
const DOMAIN = "3 · domain";

const readable = (tag) => tag.replace(/(Command|Query)$/, "");

const build = (cli) => {
  const { modules } = readServerModel();
  const only = cli.flag("module");
  const selected = only === undefined ? undefined : new Set(only.split(","));

  return [...modules.values()]
    .filter((module) => selected === undefined || selected.has(module.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((module) => {
      const graph = makeGraph({
        slug: `server-hexagon-${module.name}`,
        title: `modules/${module.name} — what depends on what`,
        direction: "LR",
      });

      const messageNode = (tag) => {
        const id = `msg:${tag}`;
        if (graph.nodes.has(id)) return id;
        const isQuery = module.queries.has(tag);
        if (!isQuery && !module.commands.has(tag)) return undefined;
        addNode(graph, {
          id,
          label: readable(tag),
          kind: isQuery ? "query" : "message",
          group: `${APPLICATION}/${isQuery ? "queries" : "commands"}`,
          link: `#${useCaseSlug(module.name, tag)}`,
          tooltip: `${tag} — open the use case in full detail`,
        });
        return id;
      };

      for (const endpoint of module.endpoints) {
        const id = `in:${endpoint.span}`;
        addNode(graph, {
          id,
          label:
            endpoint.route === undefined
              ? `${endpoint.protocol.toUpperCase()} ${endpoint.span}`
              : `${endpoint.route}`,
          kind: "interface",
          group: `${INTERFACE}/${endpoint.protocol === "cli" ? "cli" : "http"}`,
        });
        for (const tag of endpoint.dispatches) {
          const message = messageNode(tag);
          if (message !== undefined) addEdge(graph, { from: id, to: message });
        }
      }

      for (const subscription of module.subscriptions) {
        const id = `on:${subscription.event}`;
        addNode(graph, {
          id,
          label: `on ${subscription.event}`,
          kind: "interface",
          group: `${INTERFACE}/events`,
        });
        for (const tag of subscription.dispatches) {
          const message = messageNode(tag);
          if (message !== undefined) addEdge(graph, { from: id, to: message });
        }
      }

      for (const [tag, handlerName] of module.bindings) {
        const handler = module.handlers.get(handlerName);
        const message = messageNode(tag);
        if (handler === undefined || message === undefined) continue;

        if (handler.readSide) {
          addNode(graph, {
            id: "read-model",
            label: "read model<br/>SQL, no port",
            kind: "infrastructure",
            group: `${DOMAIN}/read side`,
          });
          addEdge(graph, { from: message, to: "read-model" });
        }

        for (const port of handler.ports) {
          const tier = module.ports.get(port)?.tier;
          addEdge(graph, { from: message, to: portNode(graph, module, port, tier) });
        }
        for (const root of handler.roots) {
          addNode(graph, {
            id: `root:${root}`,
            label: root,
            kind: "domain",
            group: `${DOMAIN}/aggregates`,
          });
          addEdge(graph, { from: message, to: `root:${root}`, label: "ops" });
        }
        for (const event of handler.events) {
          addNode(graph, {
            id: `event:${event}`,
            label: event,
            kind: "event",
            group: `${DOMAIN}/events`,
          });
          addEdge(graph, { from: message, to: `event:${event}`, label: "emits" });
        }
      }

      for (const port of module.policyPorts) {
        const guard = "authz:registry";
        addNode(graph, {
          id: guard,
          label: `authorization<br/>${module.checks.size} check${module.checks.size === 1 ? "" : "s"}`,
          kind: "policy",
          group: `${APPLICATION}/authorization`,
        });
        addEdge(graph, {
          from: guard,
          to: portNode(graph, module, port, module.ports.get(port)?.tier),
        });
      }

      return graph;
    })
    .filter((graph) => graph.nodes.size > 0);
};

const portNode = (graph, module, port, tier) => {
  const id = `port:${port}`;
  const roots = module.ports.get(port)?.roots ?? [];
  addNode(graph, {
    id,
    label: roots.length === 0 ? port : `${port}<br/>«${roots.join(", ")}»`,
    kind: "port",
    group: `${DOMAIN}/${tier === "acl" ? "acl ports" : "repository ports"}`,
  });
  return id;
};

export const generator = {
  name: "server-hexagon",
  describe: "one map per server module: endpoints → use cases → ports and aggregates",
  options: `  --module <a,b>        only these modules   [all]
`,
  build,
};

if (isMain(import.meta.url)) await runGenerator(generator);
