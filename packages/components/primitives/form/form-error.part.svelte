<script module lang="ts">
  export type FieldErrorProps = {
    readonly error?: string;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import * as String from "effect/String";

  const { "data-testid": testId, error = "" }: FieldErrorProps = $props();
</script>

{#if String.isNonEmpty(error)}
  <span role="alert" data-slot="form-error" data-testid={testId} class="text-sm text-destructive">
    {error}
  </span>
{/if}
