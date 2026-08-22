import * as Graph from "effect/Graph";

export const makeGraph = ({ direction = "LR", slug, title }) => ({
  slug,
  title,
  direction,
  nodes: new Map(),
  edges: new Map(),
});

export const addNode = (graph, node) => {
  const existing = graph.nodes.get(node.id);
  if (existing !== undefined) {
    if (node.label !== undefined) existing.label = node.label;
    if (node.group !== undefined) existing.group = node.group;
    if (node.kind !== undefined) existing.kind = node.kind;
    return existing;
  }
  const created = { kind: "default", group: undefined, label: node.id, ...node };
  graph.nodes.set(created.id, created);
  return created;
};

const edgeKey = (from, to) => `${from} -> ${to}`;

export const addEdge = (graph, { from, label, to, typeOnly = false, violation }) => {
  if (from === to) return;
  const key = edgeKey(from, to);
  const edge = graph.edges.get(key) ?? {
    from,
    to,
    count: 0,
    labels: new Set(),
    violations: new Set(),
    typeOnly: true,
  };
  edge.count += 1;
  edge.typeOnly = edge.typeOnly && typeOnly;
  if (label !== undefined) edge.labels.add(label);
  if (violation !== undefined) edge.violations.add(violation);
  graph.edges.set(key, edge);
};

export const isViolation = (edge) => edge.violations.size > 0;

export const filterGraph = (graph, { exclude, focus }) => {
  if (exclude === undefined && focus === undefined) return graph;
  const keep = (node) =>
    (focus === undefined || focus.test(node.id) || focus.test(node.label)) &&
    (exclude === undefined || (!exclude.test(node.id) && !exclude.test(node.label)));

  const filtered = { ...graph, nodes: new Map(), edges: new Map() };
  for (const [id, node] of graph.nodes) if (keep(node)) filtered.nodes.set(id, node);
  for (const [key, edge] of graph.edges) {
    if (filtered.nodes.has(edge.from) && filtered.nodes.has(edge.to)) filtered.edges.set(key, edge);
  }
  return filtered;
};

export const analyse = (graph) => {
  const ids = [...graph.nodes.keys()];
  const indexOf = new Map(ids.map((id, index) => [id, index]));

  const directed = Graph.directed((mutable) => {
    for (const id of ids) Graph.addNode(mutable, id);
    for (const edge of graph.edges.values()) {
      Graph.addEdge(mutable, indexOf.get(edge.from), indexOf.get(edge.to), edge.count);
    }
  });

  const cycles = Graph.stronglyConnectedComponents(directed)
    .filter((component) => component.length > 1)
    .map((component) => component.map((index) => graph.nodes.get(ids[index]).label));

  return {
    nodeCount: Graph.nodeCount(directed),
    edgeCount: Graph.edgeCount(directed),
    acyclic: Graph.isAcyclic(directed),
    cycles,
    violations: [...graph.edges.values()].filter(isViolation),
  };
};
