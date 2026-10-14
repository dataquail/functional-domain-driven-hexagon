<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "../button.svelte";
  import { Form } from "./index";

  const { Story } = defineMeta({
    title: "Primitives/Form",
    component: Form,
  });
</script>

<script lang="ts">
  let email = $state("");
  let role = $state<string | undefined>(undefined);
  let submitted = $state(false);
</script>

<Story name="Fields" asChild>
  <Form onSubmit={() => (submitted = true)}>
    <Form.Control>
      <Form.Label htmlFor="story-email" required>Email</Form.Label>
      <Form.Input
        id="story-email"
        type="email"
        value={email}
        onValueChange={(next) => (email = next)}
        invalid={submitted && email === ""}
      />
      <Form.Error error={submitted && email === "" ? "Email is required" : null} />
    </Form.Control>
    <Form.Control>
      <Form.Label>Role</Form.Label>
      <Form.Select
        value={role}
        onValueChange={(next) => (role = next)}
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
