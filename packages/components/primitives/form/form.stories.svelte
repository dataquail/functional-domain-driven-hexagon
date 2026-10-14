<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "../button.svelte";
  import { Form } from "./form.ts";

  const { Story } = defineMeta({
    title: "Primitives/Form",
    component: Form,
  });
</script>

<script lang="ts">
  const form = $state({ email: "", role: "", submitted: false });
  const emailMissing = $derived(form.submitted && form.email === "");
</script>

<Story name="Fields" asChild>
  <Form onSubmit={() => (form.submitted = true)}>
    <Form.Control>
      <Form.Label htmlFor="story-email" required>Email</Form.Label>
      <Form.Input
        id="story-email"
        type="email"
        value={form.email}
        onValueChange={(next) => (form.email = next)}
        invalid={emailMissing}
      />
      {#if emailMissing}
        <Form.Error error="Email is required" />
      {/if}
    </Form.Control>
    <Form.Control>
      <Form.Label>Role</Form.Label>
      <Form.Select
        value={form.role}
        onValueChange={(next) => (form.role = next)}
        placeholder="Choose a role"
        items={[
          { value: "admin", label: "Admin" },
          { value: "member", label: "Member" },
        ]}
      />
    </Form.Control>
    <Button type="submit">Invite</Button>
  </Form>
</Story>
