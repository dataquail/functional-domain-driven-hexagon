import { isMain, runGenerator } from "../lib/diagram/generator.mjs";
import { addEdge, addNode, makeGraph } from "../lib/diagram/graph.mjs";
import { readServerModel, useCaseSlug } from "../lib/diagram/server-model.mjs";

const INTERFACE = "1 · interface";
const APPLICATION = "2 · use case";
const DOMAIN = "3 · domain";
const INFRASTRUCTURE = "4 · infrastructure — adapters behind the ports";

const readable = (tag) => tag.replace(/(Command|Query)$/, "");

const build = (cli) => {
  const { modules, ownerOfCommand } = readServerModel();
  const only = cli.flag("module");
  const selected = only === undefined ? undefined : new Set(only.split(","));
  const graphs = [];

  for (const module of modules.values()) {
    if (selected !== undefined && !selected.has(module.name)) continue;

    for (const [tag, handlerName] of module.bindings) {
      const handler = module.handlers.get(handlerName);
      if (handler === undefined) continue;
      const isQuery = module.queries.has(tag);

      const graph = makeGraph({
        slug: useCaseSlug(module.name, tag),
        title: `${tag} — ${module.name}`,
        direction: "LR",
      });

      const message = `msg:${tag}`;
      addNode(graph, {
        id: message,
        label: readable(tag),
        kind: isQuery ? "query" : "message",
        group: `${APPLICATION}/message`,
      });
      const use = `use:${handlerName}`;
      addNode(graph, {
        id: use,
        label: handlerName,
        kind: isQuery ? "query" : "application",
        group: `${APPLICATION}/handler`,
      });
      addEdge(graph, { from: message, to: use, label: "handled by" });

      let firstDriving;
      for (const endpoint of module.endpoints) {
        if (!endpoint.dispatches.includes(tag)) continue;
        const id = `in:${endpoint.span}`;
        addNode(graph, {
          id,
          label:
            endpoint.route === undefined
              ? `${endpoint.protocol.toUpperCase()}<br/>${endpoint.span}`
              : `${endpoint.route}<br/>${endpoint.span}`,
          kind: "interface",
          group: `${INTERFACE}/${endpoint.protocol === "cli" ? "cli" : "http"}`,
        });
        firstDriving = firstDriving ?? id;

        let from = id;
        for (const policy of endpoint.policies) {
          const resource = module.resources.get(policy.resource) ?? policy.resource;
          const guard = `authz:${resource}.${policy.action}`;
          addNode(graph, {
            id: guard,
            label: `${resource}<br/>${(policy.action ?? "?").toLowerCase()}`,
            kind: "policy",
            group: `${INTERFACE}/authorization`,
          });
          addEdge(graph, { from, to: guard, label: "guards" });
          from = guard;
        }
        addEdge(graph, { from, to: message, label: "dispatches" });
      }

      for (const subscription of module.subscriptions) {
        if (!subscription.dispatches.includes(tag)) continue;
        const id = `on:${subscription.event}`;
        addNode(graph, {
          id,
          label: `on ${subscription.event}<br/>${subscription.mode}`,
          kind: "interface",
          group: `${INTERFACE}/events`,
        });
        firstDriving = firstDriving ?? id;
        addEdge(graph, { from: id, to: message, label: "dispatches" });
      }

      if (handler.readSide && handler.readsDatabase) {
        addNode(graph, {
          id: "read-model",
          label: "SQL read model<br/>@org/database — no port",
          kind: "infrastructure",
          group: `${DOMAIN}/read side`,
        });
        addEdge(graph, { from: use, to: "read-model", label: "reads" });
      }

      for (const root of handler.roots) {
        addNode(graph, {
          id: `root:${root}`,
          label: root,
          kind: "domain",
          group: `${DOMAIN}/aggregates`,
        });
        addEdge(graph, { from: use, to: `root:${root}`, label: "ops" });
      }

      for (const event of handler.events) {
        addNode(graph, {
          id: `event:${event}`,
          label: event,
          kind: "event",
          group: `${DOMAIN}/events`,
        });
        addEdge(graph, { from: use, to: `event:${event}`, label: "emits" });

        for (const consumer of modules.values()) {
          for (const subscription of consumer.subscriptions) {
            if (subscription.event !== event) continue;
            const reaction = `react:${consumer.name}.${event}`;
            addNode(graph, {
              id: reaction,
              label: `${consumer.name}<br/>${subscription.mode}${subscription.dispatches
                .map((next) => `<br/>→ ${readable(next)}`)
                .join("")}`,
              kind: "interface",
              group: `${DOMAIN}/reacts to this event`,
            });
            addEdge(graph, { from: `event:${event}`, to: reaction });
          }
        }
      }

      for (const port of handler.ports) {
        const details = module.ports.get(port);
        const id = `port:${port}`;
        addNode(graph, {
          id,
          label: details?.roots?.length > 0 ? `${port}<br/>«${details.roots.join(", ")}»` : port,
          kind: "port",
          group: `${DOMAIN}/${details?.tier === "acl" ? "acl ports" : "repository ports"}`,
        });
        addEdge(graph, { from: use, to: id, label: "uses" });

        for (const [name, adapter] of module.adapters) {
          if (adapter.provides !== port) continue;
          if (adapter.kind === "fake" && !cli.has("fakes")) continue;
          const talksTo = [...new Set([...adapter.externals, ...adapter.tables])];
          const adapterId = `adapter:${name}`;
          addNode(graph, {
            id: adapterId,
            label: talksTo.length === 0 ? name : `${name}<br/>→ ${talksTo.join(" · ")}`,
            kind: "infrastructure",
            group: `${INFRASTRUCTURE}/${adapter.kind === "fake" ? "test seam" : "live"}`,
          });
          addEdge(graph, { from: adapterId, to: id, label: "implements", relation: "implements" });
          if (firstDriving !== undefined) {
            addEdge(graph, { from: firstDriving, to: adapterId, relation: "layout" });
          }
        }
      }

      for (const dispatched of handler.dispatches) {
        if (dispatched === tag) continue;
        const owner = ownerOfCommand.get(dispatched) ?? module.name;
        const id = `next:${dispatched}`;
        addNode(graph, {
          id,
          label: `${readable(dispatched)}<br/>(${owner})`,
          kind: "message",
          group: `${APPLICATION}/dispatches onward`,
          link: `#${useCaseSlug(owner, dispatched)}`,
        });
        addEdge(graph, { from: use, to: id });
      }

      graphs.push(graph);
    }
  }

  return graphs;
};

export const generator = {
  name: "server-usecase",
  describe:
    "one diagram per command or query: who dispatches it, what it touches, what implements its ports",
  options: `  --module <a,b>        only these modules   [all]
  --fakes               include the *-fake adapters (the test seam on the same port)
`,
  build,
};

if (isMain(import.meta.url)) await runGenerator(generator);
