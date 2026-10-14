<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "./button.svelte";
  import { PlusIcon, TrashIcon } from "./icon/icons";

  const { Story } = defineMeta({
    title: "Primitives/Button",
    component: Button,
    argTypes: {
      variant: {
        control: "inline-radio",
        options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
      },
      size: { control: "inline-radio", options: ["default", "sm", "lg", "icon"] },
      width: { control: "inline-radio", options: ["auto", "full"] },
    },
  });
</script>

<Story name="Default">Save</Story>

<Story name="Variants" asChild>
  <Button>Default</Button>
  <Button variant="destructive">Destructive</Button>
  <Button variant="outline">Outline</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="link">Link</Button>
</Story>

<Story name="With icons" asChild>
  <Button><PlusIcon /> Add todo</Button>
  <Button variant="outline" size="icon" aria-label="Delete"><TrashIcon /></Button>
</Story>

<Story name="Loading" args={{ loading: true, disabled: true }}>Saving</Story>

<Story name="Full width" args={{ width: "full" }}>Continue</Story>
