<script module lang="ts">
  import type { Snippet } from "svelte";

  export type LabelTone = "default" | "muted";
  export type LabelDecoration = "none" | "line-through";

  const TONE: Record<LabelTone, string> = {
    default: "text-foreground",
    muted: "text-muted-foreground",
  };

  const DECORATION: Record<LabelDecoration, string> = {
    none: "",
    "line-through": "line-through",
  };

  export type LabelProps = {
    readonly htmlFor?: string;
    readonly required?: boolean;
    readonly tone?: LabelTone;
    readonly decoration?: LabelDecoration;
    /** Clip to one line with an ellipsis. Needs an ancestor that may shrink. */
    readonly truncate?: boolean;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import { Label as LabelPrimitive } from "bits-ui";

  const {
    children,
    "data-testid": testId,
    decoration = "none",
    htmlFor,
    required = false,
    tone = "default",
    truncate = false,
  }: LabelProps = $props();
</script>

<LabelPrimitive.Root
  data-slot="label"
  data-testid={testId}
  for={htmlFor}
  class={[
    "text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
    TONE[tone],
    DECORATION[decoration],
    truncate && "block truncate",
    htmlFor !== undefined && "cursor-pointer",
  ]}
>
  {@render children?.()}
  {#if required}
    <span class="ml-0.5 text-destructive">*</span>
  {/if}
</LabelPrimitive.Root>
