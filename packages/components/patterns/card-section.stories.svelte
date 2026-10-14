<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "../primitives/button.svelte";
  import CardSection from "./card-section.svelte";

  const { Story } = defineMeta({
    title: "Patterns/CardSection",
    component: CardSection,
    argTypes: {
      titleSize: { control: "inline-radio", options: ["sm", "md", "lg", "xl"] },
      titleAlign: { control: "inline-radio", options: ["start", "center"] },
      headerPadding: { control: "inline-radio", options: ["default", "tight"] },
    },
  });
</script>

<Story name="Default" args={{ title: "Invite a teammate" }}>The section's body.</Story>

<Story name="With an action" asChild>
  <CardSection title="Members">
    {#snippet action()}
      <Button size="sm">Invite</Button>
    {/snippet}
    Three members.
  </CardSection>
</Story>
