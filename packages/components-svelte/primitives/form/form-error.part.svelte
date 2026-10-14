<script module lang="ts">
  export type FieldErrorProps = {
    readonly error?: string | null | undefined;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import * as String from "effect/String";

  const { "data-testid": testId, error = null }: FieldErrorProps = $props();
</script>

{#if error !== null && !String.isEmpty(error)}
  <span role="alert" data-slot="form-error" data-testid={testId} class="text-sm text-destructive">
    {error}
  </span>
{/if}
