<script module lang="ts">
  export type CheckboxProps = {
    readonly id?: string;
    readonly name?: string;
    readonly checked: boolean;
    readonly onCheckedChange: (checked: boolean) => void;
    readonly disabled?: boolean;
    readonly "aria-label"?: string;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import { Checkbox as CheckboxPrimitive } from "bits-ui";

  import { CheckIcon } from "./icon/icons";

  const {
    "aria-label": ariaLabel,
    checked,
    "data-testid": testId,
    disabled = false,
    id,
    name,
    onCheckedChange,
  }: CheckboxProps = $props();
</script>

<CheckboxPrimitive.Root
  {id}
  {name}
  bind:checked={() => checked, onCheckedChange}
  {disabled}
  aria-label={ariaLabel}
  data-slot="checkbox"
  data-testid={testId}
  class="peer flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary text-current shadow focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
>
  {#snippet children({ checked: isChecked })}
    {#if isChecked}
      <CheckIcon size="md" />
    {/if}
  {/snippet}
</CheckboxPrimitive.Root>
