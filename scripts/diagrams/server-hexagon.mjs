import { isMain, runGenerator } from "../lib/diagram/generator.mjs";
import { addEdge, addNode, makeGraph } from "../lib/diagram/graph.mjs";
import { readServerModel } from "../lib/diagram/server-model.mjs";

// Dependency points inward, so the lanes run outward → inward, left → right.
// A driving adapter and a driven adapter both point right: one into a use case,
// one into the port it implements. Nothing in a lane depends on a lane to its left.
const OUTER = "1 · adapters — interface &amp; infrastructure";
const APPLICATION = "2 · use cases — commands &amp; queries";
const DOMAIN = "3 · domain";

const COLUMNS = {
  driving: `${OUTER}/driving · interface`,
  driven: `${OUTER}/driven · infrastructure`,
  authorization: `${APPLICATION}/authorization`,
  messages: `${APPLICATION}/messages on the bus`,
  useCases: `${APPLICATION}/handlers`,
  ports: `${DOMAIN}/ports`,
  events: `${DOMAIN}/domain events`,
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

      const boundary = () => COLUMNS.ports;
      let firstDriving;
      const driving = (id, label) => {
        addNode(graph, { id, label, kind: "interface", group: COLUMNS.driving });
        firstDriving = firstDriving ?? id;
        return id;
      };

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
          addNode(graph, { id: `port:${port}`, label: port, kind: "port", group: boundary() });
          addEdge(graph, { from: id, to: `port:${port}`, label: "consults" });
        }
        for (const tag of module.policyQueries) {
          addEdge(graph, { from: id, to: messageNode(tag), label: "asks" });
        }
        return id;
      };

      for (const endpoint of module.endpoints) {
        const id = driving(
          `in:${endpoint.span}`,
          endpoint.route === undefined
            ? `${endpoint.protocol.toUpperCase()}<br/>${endpoint.span}`
            : `${endpoint.route}<br/>${endpoint.span}`,
        );

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
        const id = driving(
          `on:${subscription.event}`,
          `on ${subscription.event}<br/>${subscription.mode}`,
        );
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
          label:
            handler.readSide && handler.readsDatabase
              ? `${handlerName}<br/>reads SQL directly — no port`
              : handlerName,
          kind: handler.readSide ? "query" : "application",
          group: COLUMNS.useCases,
        });
        addEdge(graph, { from: messageNode(tag), to: id, label: "handled by" });

        for (const port of handler.ports) {
          addNode(graph, {
            id: `port:${port}`,
            label: port,
            kind: "port",
            group: boundary(),
          });
          addEdge(graph, { from: id, to: `port:${port}`, label: "uses" });
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
        const talksTo = [...new Set([...adapter.externals, ...adapter.tables])];
        addNode(graph, {
          id: `adapter:${name}`,
          label: talksTo.length === 0 ? name : `${name}<br/>→ ${talksTo.join(" · ")}`,
          kind: "infrastructure",
          group: COLUMNS.driven,
        });
        // Without this the adapter ranks next to the port it implements, and the
        // outer lane stretches across the whole diagram to reach it.
        if (firstDriving !== undefined) {
          addEdge(graph, { from: firstDriving, to: `adapter:${name}`, relation: "layout" });
        }
        if (implemented) {
          addNode(graph, {
            id: `port:${adapter.provides}`,
            label: adapter.provides,
            kind: "port",
            group: boundary(),
          });
          addEdge(graph, {
            from: `adapter:${name}`,
            to: `port:${adapter.provides}`,
            label: "implements",
            relation: "implements",
          });
        }
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
