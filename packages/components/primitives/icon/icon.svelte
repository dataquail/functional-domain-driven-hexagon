<script module lang="ts">
  import type { LucideIcon } from "@lucide/svelte";

  import type { IconProps, IconSize, IconTone } from "./icon-props";

  export type LucideIconProps = IconProps & { readonly lucide: LucideIcon };

  const SIZE_CLASS: Record<IconSize, string> = {
    sm: "size-3",
    md: "size-4",
    lg: "size-5",
  };

  const TONE_CLASS: Record<IconTone, string> = {
    default: "text-foreground",
    muted: "text-muted-foreground",
    destructive: "text-destructive",
    inherit: "",
  };
</script>

<script lang="ts">
  const {
    "aria-hidden": ariaHidden = true,
    "aria-label": ariaLabel,
    "data-testid": testId,
    lucide: Lucide,
    size = "md",
    tone = "inherit",
  }: LucideIconProps = $props();
</script>

<Lucide
  class={[SIZE_CLASS[size], TONE_CLASS[tone]]}
  aria-hidden={ariaHidden}
  aria-label={ariaLabel}
  data-testid={testId}
/>
