import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    starlight({
      title: "Architecture Rules",
      description:
        "Architecture policy as one manifest of your repository, enforced by oxlint — import boundaries, export sites, member vocabularies and file taxonomy, all resolved to real files.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/dataquail/oxlint-architecture-rules",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { slug: "getting-started/introduction" },
            { slug: "getting-started/installation" },
          ],
        },
        {
          label: "The Manifest",
          items: [
            { slug: "manifest", label: "Overview" },
            { slug: "manifest/patterns" },
            { slug: "manifest/imports" },
            { slug: "manifest/imported-by" },
            { slug: "manifest/exports" },
            { slug: "manifest/members" },
            { slug: "manifest/structure" },
            { slug: "manifest/inheritance" },
          ],
        },
        {
          label: "Enforcement",
          items: [
            { slug: "enforcement/resolution" },
            { slug: "enforcement/probes" },
            { slug: "enforcement/baseline" },
            { slug: "enforcement/cli" },
          ],
        },
      ],
    }),
  ],
  site: "https://dataquail.github.io",
  base: "/oxlint-architecture-rules",
});
