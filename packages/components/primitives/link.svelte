<script module lang="ts">
  import type { Snippet } from "svelte";

  export type LinkTone = "default" | "muted" | "primary" | "inherit";
  export type LinkUnderline = "none" | "hover" | "always";
  export type LinkAppearance = "text" | "nav-item" | "button";

  const TONE: Record<LinkTone, string> = {
    default: "text-foreground hover:text-foreground",
    muted: "text-muted-foreground hover:text-foreground",
    primary: "text-primary",
    inherit: "",
  };

  const UNDERLINE: Record<LinkUnderline, string> = {
    none: "no-underline",
    hover: "underline-offset-4 hover:underline",
    always: "underline underline-offset-4",
  };

  const APPEARANCE: Record<LinkAppearance, string> = {
    text: "",
    "nav-item": "rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent",
    button:
      "inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-accent",
  };

  export type LinkProps = {
    readonly href: string;
    readonly tone?: LinkTone;
    readonly underline?: LinkUnderline;
    readonly appearance?: LinkAppearance;
    /** Stretch to fill a parent Stack cell, so the whole row is clickable. */
    readonly block?: boolean;
    /** Preload the destination on hover (true) or never (false); unset leaves the router's default. */
    readonly prefetch?: boolean;
    /** Leave the app: a full document load rather than a client-side transition.
     *  Needed for anything the BFF must see as a top-level navigation. */
    readonly external?: boolean;
    readonly children?: Snippet;
    readonly "aria-label"?: string;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    appearance = "text",
    "aria-label": ariaLabel,
    block = false,
    children,
    "data-testid": testId,
    external = false,
    href,
    prefetch,
    tone = "primary",
    underline = "hover",
  }: LinkProps = $props();
</script>

<a
  {href}
  aria-label={ariaLabel}
  data-slot="link"
  data-testid={testId}
  data-sveltekit-reload={external || undefined}
  data-sveltekit-preload-data={prefetch === undefined ? undefined : prefetch ? "hover" : "off"}
  class={[
    "transition-colors focus-visible:outline-1",
    TONE[tone],
    UNDERLINE[underline],
    APPEARANCE[appearance],
    block && "block",
  ]}
>
  {@render children?.()}
</a>
