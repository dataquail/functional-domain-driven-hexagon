<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Link from "./link.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Link",
    component: Link,
    argTypes: {
      tone: { control: "inline-radio", options: ["default", "muted", "primary", "inherit"] },
      underline: { control: "inline-radio", options: ["none", "hover", "always"] },
      appearance: { control: "inline-radio", options: ["text", "nav-item", "button"] },
    },
  });
</script>

<Story name="Default" args={{ href: "#" }}>Organizations</Story>

<Story name="Appearances" asChild>
  <Link href="#">Text</Link>
  <Link href="#" appearance="nav-item" tone="muted">Nav item</Link>
  <Link href="#" appearance="button" tone="default">Button-like</Link>
</Story>

<Story name="External" args={{ href: "#", external: true }}>Sign in</Story>
