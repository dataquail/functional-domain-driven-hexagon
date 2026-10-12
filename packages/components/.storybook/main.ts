import type { StorybookConfig } from "@storybook/svelte-vite";
import { dirname } from "path";
import { fileURLToPath } from "url";

// pnpm keeps addons under node_modules/.pnpm, so each is named by its absolute path.
function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ["../primitives/**/*.stories.svelte", "../patterns/**/*.stories.svelte"],
  addons: [
    getAbsolutePath("@storybook/addon-svelte-csf"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-themes"),
  ],
  framework: getAbsolutePath("@storybook/svelte-vite"),
};

export default config;
