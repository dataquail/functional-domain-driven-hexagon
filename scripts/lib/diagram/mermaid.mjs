import { isViolation } from "./graph.mjs";

// Only the shapes whose quoted-label form is stable across mermaid 10/11 —
// the slanted ones (parallelogram, trapezoid) reject a quoted label.
const SHAPES = {
  rect: (label) => `["${label}"]`,
  round: (label) => `("${label}")`,
  stadium: (label) => `(["${label}"])`,
  subroutine: (label) => `[["${label}"]]`,
  cylinder: (label) => `[("${label}")]`,
  hexagon: (label) => `{{"${label}"}}`,
};

const KINDS = {
  default: { shape: "rect", fill: "#e5e7eb", stroke: "#6b7280" },
  package: { shape: "stadium", fill: "#dbeafe", stroke: "#2563eb" },
  external: { shape: "stadium", fill: "#f3f4f6", stroke: "#9ca3af" },
  module: { shape: "rect", fill: "#dbeafe", stroke: "#2563eb" },
  composition: { shape: "hexagon", fill: "#ede9fe", stroke: "#7c3aed" },
  domain: { shape: "hexagon", fill: "#fef3c7", stroke: "#d97706" },
  port: { shape: "round", fill: "#fef9c3", stroke: "#ca8a04" },
  application: { shape: "rect", fill: "#dcfce7", stroke: "#16a34a" },
  message: { shape: "subroutine", fill: "#d1fae5", stroke: "#059669" },
  query: { shape: "subroutine", fill: "#cffafe", stroke: "#0891b2" },
  policy: { shape: "subroutine", fill: "#dcfce7", stroke: "#15803d" },
  saga: { shape: "round", fill: "#dcfce7", stroke: "#15803d" },
  infrastructure: { shape: "cylinder", fill: "#e0e7ff", stroke: "#4f46e5" },
  interface: { shape: "stadium", fill: "#ffe4e6", stroke: "#e11d48" },
  route: { shape: "stadium", fill: "#ffe4e6", stroke: "#e11d48" },
  feature: { shape: "rect", fill: "#dbeafe", stroke: "#2563eb" },
  view: { shape: "stadium", fill: "#ffe4e6", stroke: "#e11d48" },
  viewModel: { shape: "rect", fill: "#dcfce7", stroke: "#16a34a" },
  atom: { shape: "round", fill: "#dcfce7", stroke: "#15803d" },
  modelAtom: { shape: "round", fill: "#fef3c7", stroke: "#d97706" },
  model: { shape: "cylinder", fill: "#fef3c7", stroke: "#d97706" },
  kernel: { shape: "hexagon", fill: "#ede9fe", stroke: "#7c3aed" },
};

const VIOLATION_STROKE = "#dc2626";

const escape = (text) => String(text).replaceAll('"', "#quot;");

const groupPath = (node) => (node.group === undefined ? [] : node.group.split("/"));

const buildGroupTree = (nodes) => {
  const root = { label: undefined, children: new Map(), nodes: [] };
  for (const node of nodes) {
    let cursor = root;
    for (const segment of groupPath(node)) {
      if (!cursor.children.has(segment)) {
        cursor.children.set(segment, { label: segment, children: new Map(), nodes: [] });
      }
      cursor = cursor.children.get(segment);
    }
    cursor.nodes.push(node);
  }
  return root;
};

export const toMermaid = (graph) => {
  const nodes = [...graph.nodes.values()];
  const idOf = new Map(nodes.map((node, index) => [node.id, `n${index}`]));

  const lines = [];
  if (graph.title !== undefined) {
    lines.push("---", `title: ${graph.title}`, "---");
  }
  lines.push(`flowchart ${graph.direction}`);

  let subgraphSerial = 0;
  const subgraphIds = [];
  const emitGroup = (group, depth) => {
    const pad = "  ".repeat(depth);
    for (const node of group.nodes) {
      const kind = KINDS[node.kind] ?? KINDS.default;
      lines.push(`${pad}${idOf.get(node.id)}${SHAPES[kind.shape](escape(node.label))}`);
    }
    for (const child of group.children.values()) {
      subgraphSerial += 1;
      subgraphIds.push(`g${subgraphSerial}`);
      lines.push(`${pad}subgraph g${subgraphSerial}["${escape(child.label)}"]`);
      lines.push(`${pad}  direction ${graph.direction}`);
      emitGroup(child, depth + 1);
      lines.push(`${pad}end`);
    }
  };
  emitGroup(buildGroupTree(nodes), 1);

  const violatingLinks = [];
  const typeOnlyLinks = [];
  const implementsLinks = [];
  let linkSerial = 0;
  for (const edge of graph.edges.values()) {
    const from = idOf.get(edge.from);
    const to = idOf.get(edge.to);
    if (from === undefined || to === undefined) continue;

    // An invisible link carries no meaning of its own: it exists to hold a node
    // in the lane its layer belongs to, which dagre would otherwise collapse.
    if (edge.relation === "layout") {
      lines.push(`  ${from} ~~~ ${to}`);
      linkSerial += 1;
      continue;
    }

    const violated = isViolation(edge);
    const label = violated
      ? [...edge.violations].join(" · ")
      : [...edge.labels].sort().join(" · ") || undefined;

    if (violated) violatingLinks.push(linkSerial);
    else if (edge.relation === "implements") implementsLinks.push(linkSerial);
    else if (edge.typeOnly) typeOnlyLinks.push(linkSerial);
    linkSerial += 1;

    const arrow = !violated && (edge.typeOnly || edge.relation === "implements") ? "-.->" : "-->";
    lines.push(
      label === undefined
        ? `  ${from} ${arrow} ${to}`
        : `  ${from} ${arrow}|"${escape(label)}"| ${to}`,
    );
  }

  for (const id of subgraphIds) {
    lines.push(`  style ${id} fill:none,stroke:#9ca3af,stroke-dasharray:3 3`);
  }

  const usedKinds = new Set(nodes.map((node) => (node.kind in KINDS ? node.kind : "default")));
  for (const kind of [...usedKinds].sort()) {
    const { fill, stroke } = KINDS[kind];
    lines.push(`  classDef ${kind} fill:${fill},stroke:${stroke},stroke-width:1px,color:#111827`);
  }
  for (const kind of [...usedKinds].sort()) {
    const members = nodes
      .filter((node) => (node.kind in KINDS ? node.kind : "default") === kind)
      .map((node) => idOf.get(node.id));
    if (members.length > 0) lines.push(`  class ${members.join(",")} ${kind}`);
  }

  if (violatingLinks.length > 0) {
    lines.push(
      `  linkStyle ${violatingLinks.join(",")} stroke:${VIOLATION_STROKE},stroke-width:2.5px,color:${VIOLATION_STROKE}`,
    );
  }
  if (typeOnlyLinks.length > 0) {
    lines.push(`  linkStyle ${typeOnlyLinks.join(",")} stroke:#9ca3af,stroke-width:1px`);
  }
  if (implementsLinks.length > 0) {
    lines.push(
      `  linkStyle ${implementsLinks.join(",")} stroke:#ca8a04,stroke-width:2px,color:#a16207`,
    );
  }

  lines.push("");
  lines.push("%% generated by `pnpm diagrams` — edit the code, not this file");
  lines.push("%% red edge = an import the architecture rules forbid");
  lines.push("%% dashed amber edge = an adapter implementing a port");
  lines.push("%% dotted grey edge = type-only import");

  return lines.join("\n");
};
