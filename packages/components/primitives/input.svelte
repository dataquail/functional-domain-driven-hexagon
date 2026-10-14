<script module lang="ts">
  export type InputType = "text" | "email" | "password" | "search" | "tel" | "url";

  export type InputProps = {
    readonly id?: string;
    readonly name?: string;
    readonly type?: InputType;
    readonly value: string;
    readonly onValueChange: (value: string) => void;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly required?: boolean;
    readonly autoComplete?: AutoFill;
    readonly invalid?: boolean;
    readonly "aria-label"?: string;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    "aria-label": ariaLabel,
    autoComplete,
    "data-testid": testId,
    disabled = false,
    id,
    invalid = false,
    name,
    onValueChange,
    placeholder,
    required = false,
    type = "text",
    value,
  }: InputProps = $props();
</script>

<input
  {id}
  {name}
  {type}
  {value}
  oninput={(event) => {
    onValueChange(event.currentTarget.value);
    // Strictly controlled: an edit the owner did not take is undone.
    if (event.currentTarget.value !== value) event.currentTarget.value = value;
  }}
  {placeholder}
  {disabled}
  {required}
  autocomplete={autoComplete}
  aria-invalid={invalid || undefined}
  aria-label={ariaLabel}
  data-slot="input"
  data-testid={testId}
  class={[
    "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  ]}
/>
