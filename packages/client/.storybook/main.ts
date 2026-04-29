import type { StorybookConfig } from "@storybook/react-vite";
import { dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Resolves the absolute path of a workspace package — required for pnpm in a monorepo.
 */
function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)", "../src/**/*.mdx"],
  addons: [
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-themes"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
};

export default config;
