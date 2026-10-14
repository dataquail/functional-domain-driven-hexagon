<script module lang="ts">
  export type SelectTriggerWidth = "auto" | "full" | "sm" | "md" | "lg";

  const TRIGGER_WIDTH: Record<SelectTriggerWidth, string> = {
    auto: "w-auto",
    full: "w-full",
    sm: "w-40",
    md: "w-50",
    lg: "w-70",
  };

  const SCROLL_BUTTON = "flex cursor-default items-center justify-center py-1";

  export type SelectItem = {
    readonly value: string;
    readonly label: string;
    readonly disabled?: boolean;
    readonly "data-testid"?: string;
  };

  // The items are a prop rather than children: the trigger shows the selected
  // label while the list is closed, before any item has rendered.
  export type SelectProps = {
    // Absent while nothing is selected; the trigger then shows the placeholder.
    readonly value?: string;
    readonly onValueChange: (value: string) => void;
    readonly items: ReadonlyArray<SelectItem>;
    readonly placeholder?: string;
    readonly width?: SelectTriggerWidth;
    readonly disabled?: boolean;
    readonly "aria-label"?: string;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";

  import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "./icon/icons";

  const {
    "aria-label": ariaLabel,
    "data-testid": testId,
    disabled = false,
    items,
    onValueChange,
    placeholder,
    value = "",
    width = "full",
  }: SelectProps = $props();
</script>

<SelectPrimitive.Root
  type="single"
  bind:value={() => value, onValueChange}
  items={items.map(({ disabled: itemDisabled = false, label, value: itemValue }) => ({
    value: itemValue,
    label,
    disabled: itemDisabled,
  }))}
  {disabled}
>
  <SelectPrimitive.Trigger
    aria-label={ariaLabel}
    data-slot="select-trigger"
    data-testid={testId}
    class={[
      TRIGGER_WIDTH[width],
      "flex h-9 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1",
    ]}
  >
    <SelectPrimitive.Value data-slot="select-value" {placeholder} />
    <ChevronDownIcon size="md" tone="muted" />
  </SelectPrimitive.Trigger>
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      data-slot="select-content"
      sideOffset={4}
      class="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      <SelectPrimitive.ScrollUpButton class={SCROLL_BUTTON}>
        <ChevronUpIcon size="md" tone="muted" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport
        class="h-[var(--bits-floating-anchor-height)] w-full min-w-[var(--bits-floating-anchor-width)] p-1"
      >
        {#each items as item (item.value)}
          <SelectPrimitive.Item
            value={item.value}
            label={item.label}
            disabled={item.disabled ?? false}
            data-slot="select-item"
            data-testid={item["data-testid"]}
            class="relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
          >
            {#snippet children({ selected })}
              {item.label}
              <span class="absolute right-2 flex size-3.5 items-center justify-center">
                {#if selected}
                  <CheckIcon size="md" />
                {/if}
              </span>
            {/snippet}
          </SelectPrimitive.Item>
        {/each}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton class={SCROLL_BUTTON}>
        <ChevronDownIcon size="md" tone="muted" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
</SelectPrimitive.Root>
