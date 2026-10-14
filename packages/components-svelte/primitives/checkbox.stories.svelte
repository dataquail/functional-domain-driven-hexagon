<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Checkbox from "./checkbox.svelte";
  import Label from "./label.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Checkbox",
    component: Checkbox,
  });
</script>

<script lang="ts">
  let checked = $state(false);
</script>

<Story name="Controlled" asChild>
  <Checkbox id="story-checkbox" {checked} onCheckedChange={(next) => (checked = next)} />
  <Label htmlFor="story-checkbox">Remember me</Label>
</Story>

<Story name="Checked" args={{ checked: true, onCheckedChange: () => {} }} />

<Story name="Disabled" args={{ checked: false, disabled: true, onCheckedChange: () => {} }} />
