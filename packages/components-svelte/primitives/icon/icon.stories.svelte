<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import {
    CheckIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    CloseIcon,
    PlusIcon,
    TrashIcon,
  } from "./index";

  const { Story } = defineMeta({
    title: "Primitives/Icon",
    component: PlusIcon,
    argTypes: {
      size: { control: "inline-radio", options: ["sm", "md", "lg"] },
      tone: { control: "inline-radio", options: ["default", "muted", "destructive", "inherit"] },
    },
  });
</script>

<Story name="Plus" args={{ size: "lg", tone: "default" }} />

<Story name="Every icon" asChild>
  <PlusIcon />
  <TrashIcon />
  <CheckIcon />
  <CloseIcon />
  <ChevronLeftIcon />
  <ChevronRightIcon />
  <ChevronUpIcon />
  <ChevronDownIcon />
</Story>

<Story name="Tones" asChild>
  <TrashIcon size="lg" tone="default" />
  <TrashIcon size="lg" tone="muted" />
  <TrashIcon size="lg" tone="destructive" />
</Story>
