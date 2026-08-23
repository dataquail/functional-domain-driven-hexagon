import { generator as packages } from "../../diagrams/packages.mjs";
import { reader as serverHexagon } from "../../diagrams/server-hexagon.mjs";
import { generator as serverModule } from "../../diagrams/server-module.mjs";
import { generator as serverModules } from "../../diagrams/server-modules.mjs";
import { reader as serverUseCase } from "../../diagrams/server-usecase.mjs";
import { generator as webFeature } from "../../diagrams/web-feature.mjs";
import { generator as webOverview } from "../../diagrams/web-overview.mjs";
import { cached } from "./model-cache.mjs";

const NO_CLI = { flag: (_option, fallback) => fallback, has: () => false, argv: [] };

// A reader that can draw one subject without drawing its siblings: the shape
// every new zoom level should have, because it is what lets the server answer
// a single slug in milliseconds.
const addressable = (reader) => ({
  kind: reader.kind,
  title: reader.title,
  slugs: () =>
    reader.subjects().map((subject) => ({
      slug: `${reader.kind}-${subject.id}`,
      label: subject.label,
      group: subject.group,
    })),
  draw: (slug, options) =>
    slug.startsWith(`${reader.kind}-`)
      ? reader.draw(slug.slice(reader.kind.length + 1), options)
      : undefined,
});

// A generator that only knows how to build its whole set at once. Cheap enough
// once the program is warm, and the seam is the same, so the viewer cannot tell.
const wholeSet = ({ args = [], group, kind, title }) => {
  const all = cached(() =>
    kind.build({ ...NO_CLI, flag: (option, fallback) => args[option] ?? fallback }),
  );
  return {
    kind: kind.name,
    title,
    slugs: () => all.get().map((graph) => ({ slug: graph.slug, label: graph.slug, group })),
    draw: (slug) => all.get().find((graph) => graph.slug === slug),
  };
};

export const readers = [
  addressable(serverHexagon),
  addressable(serverUseCase),
  wholeSet({ kind: serverModules, title: "Across modules" }),
  wholeSet({ kind: packages, title: "Across modules" }),
  wholeSet({ kind: serverModule, title: "Module shape", args: { granularity: "folder" } }),
  wholeSet({ kind: webOverview, title: "Web" }),
  wholeSet({ kind: webFeature, title: "Web" }),
];

export const allSlugs = () =>
  readers.flatMap((reader) =>
    reader.slugs().map((entry) => ({ ...entry, kind: reader.kind, title: reader.title })),
  );

export const draw = (slug, options) => {
  for (const reader of readers) {
    const graph = reader.draw(slug, options);
    if (graph !== undefined) return graph;
  }
  return undefined;
};
