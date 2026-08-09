// oxlint's config is JSON, but the file taxonomy (ADR-0008) is authored in
// `project-structure.config.mjs`, where helper functions keep the repetitive
// port/adapter parity rules DRY. Serialising those configs into the JSON would
// make the JSON the source of truth and cost us the helpers, so instead each
// taxonomy gets a rule here with its config already bound. `.oxlintrc.json`
// then enables `project-structure/<name>` with no options.
import { projectStructurePlugin } from "eslint-plugin-project-structure";

import {
  componentsPatterns,
  componentsPrimitives,
  cqrsPackage,
  serverModules,
  webFeatures,
  webTanstackBridge,
} from "../../project-structure.config.mjs";

const folderStructure = projectStructurePlugin.rules["folder-structure"];

const withBoundConfig = (config) => ({
  ...folderStructure,
  create: (context) =>
    folderStructure.create(
      new Proxy(context, {
        get: (target, property, receiver) =>
          property === "options" ? [config] : Reflect.get(target, property, receiver),
      }),
    ),
});

export const rules = {
  "server-modules": withBoundConfig(serverModules),
  "components-primitives": withBoundConfig(componentsPrimitives),
  "components-patterns": withBoundConfig(componentsPatterns),
  "web-features": withBoundConfig(webFeatures),
  "web-tanstack-bridge": withBoundConfig(webTanstackBridge),
  "cqrs-package": withBoundConfig(cqrsPackage),
};

export default { meta: { name: "project-structure" }, rules };
