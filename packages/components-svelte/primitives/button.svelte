<script module lang="ts">
  import type { Snippet } from "svelte";

  export type ButtonVariant =
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  export type ButtonSize = "default" | "sm" | "lg" | "icon";
  export type ButtonWidth = "auto" | "full";
  export type ButtonType = "button" | "submit" | "reset";

  const BASE =
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-ring/10 outline-ring/50 transition-all active:scale-95 focus-visible:ring-4 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 dark:ring-ring/20 dark:outline-ring/40 [&_svg]:pointer-events-none [&_svg]:shrink-0";

  const VARIANT: Record<ButtonVariant, string> = {
    default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
    outline:
      "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };

  const SIZE: Record<ButtonSize, string> = {
    default: "h-9 px-4 py-2 has-[>svg]:px-3",
    sm: "h-8 rounded-md px-3 has-[>svg]:px-2.5",
    lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
    icon: "size-9",
  };

  const WIDTH: Record<ButtonWidth, string> = {
    auto: "",
    full: "w-full",
  };

  export type ButtonProps = {
    readonly type?: ButtonType;
    readonly variant?: ButtonVariant;
    readonly size?: ButtonSize;
    readonly width?: ButtonWidth;
    readonly disabled?: boolean;
    /** Show a spinner before the label. Does not disable the button on its own. */
    readonly loading?: boolean;
    readonly onClick?: () => void;
    readonly "aria-label"?: string;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import Spinner from "./spinner.svelte";

  const {
    "aria-label": ariaLabel,
    children,
    "data-testid": testId,
    disabled = false,
    loading = false,
    onClick,
    size = "default",
    type = "button",
    variant = "default",
    width = "auto",
  }: ButtonProps = $props();
</script>

<button
  {type}
  {disabled}
  onclick={onClick}
  aria-label={ariaLabel}
  data-slot="button"
  data-testid={testId}
  class={[BASE, VARIANT[variant], SIZE[size], WIDTH[width]]}
>
  {#if loading}
    <Spinner size="sm" tone="inherit" />
  {/if}
  {@render children?.()}
</button>
