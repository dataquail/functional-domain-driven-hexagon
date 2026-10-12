<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "../button.svelte";
  import { showToast, Toaster } from "./index";

  const { Story } = defineMeta({
    title: "Primitives/Toaster",
    component: Toaster,
  });
</script>

<Story name="Success and error" asChild>
  <Toaster />
  <Button onClick={() => showToast("success", "User created!")}>Succeed</Button>
  <Button variant="destructive" onClick={() => showToast("error", "Something went wrong")}>
    Fail
  </Button>
</Story>
