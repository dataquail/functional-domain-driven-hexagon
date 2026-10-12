<script module lang="ts">
  import type { Snippet } from "svelte";

  export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

  const BASE =
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold";

  const VARIANT: Record<BadgeVariant, string> = {
    default: "border-transparent bg-primary text-primary-foreground shadow-sm",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-destructive-foreground shadow-sm",
    outline: "text-foreground",
  };

  export type BadgeProps = {
    readonly variant?: BadgeVariant;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const { children, "data-testid": testId, variant = "default" }: BadgeProps = $props();
</script>

<span data-slot="badge" data-testid={testId} class={[BASE, VARIANT[variant]]}>
  {@render children?.()}
</span>
