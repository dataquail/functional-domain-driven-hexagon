<script module lang="ts">
  import type { Snippet } from "svelte";

  export type FormProps = {
    readonly onSubmit: () => void;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const { children, "data-testid": testId, onSubmit }: FormProps = $props();
</script>

<!-- The default is prevented here, so a screen says what to do on submit, never what to stop. -->
<form
  data-slot="form"
  data-testid={testId}
  class="flex flex-col gap-4"
  onsubmit={(event) => {
    event.preventDefault();
    event.stopPropagation();
    onSubmit();
  }}
>
  {@render children?.()}
</form>
