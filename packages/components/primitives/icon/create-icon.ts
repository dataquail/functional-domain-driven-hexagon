import type { LucideIcon } from "@lucide/svelte";
import type { Component } from "svelte";

import Icon from "./icon.svelte";
import type { IconProps } from "./icon-props";

// Getters, not a spread: a spread would read each prop once and stop following it.
export const createIcon =
  (lucide: LucideIcon): Component<IconProps> =>
  (internals, props) =>
    Icon(internals, {
      get size() {
        return props.size;
      },
      get tone() {
        return props.tone;
      },
      get "aria-label"() {
        return props["aria-label"];
      },
      get "aria-hidden"() {
        return props["aria-hidden"];
      },
      get "data-testid"() {
        return props["data-testid"];
      },
      lucide,
    });
