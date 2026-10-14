<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Text from "./text.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Text",
    component: Text,
    argTypes: {
      size: { control: "inline-radio", options: ["xs", "sm", "base", "lg"] },
      tone: { control: "inline-radio", options: ["default", "muted", "destructive", "inherit"] },
      weight: { control: "inline-radio", options: ["normal", "medium", "semibold"] },
      align: { control: "inline-radio", options: ["start", "center", "end"] },
    },
  });
</script>

<Story name="Default">The quick brown fox jumps over the lazy dog.</Story>

<Story name="Tones" asChild>
  <Text>Default</Text>
  <Text tone="muted">Muted</Text>
  <Text tone="destructive" weight="semibold">Destructive</Text>
</Story>
