import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Form } from "./form";

const meta = {
  title: "Primitives/Form",
  component: Form,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Form
      className="w-72"
      onSubmit={() => {
        /* demo */
      }}
    >
      <Form.Control>
        <Form.Label htmlFor="name">Name</Form.Label>
        <Form.Input id="name" placeholder="Ada Lovelace" />
      </Form.Control>
      <Form.Control>
        <Form.Label htmlFor="email" required>
          Email
        </Form.Label>
        <Form.Input id="email" type="email" placeholder="ada@example.com" />
        <Form.Error error="Email is required" />
      </Form.Control>
      <Button type="submit">Submit</Button>
    </Form>
  ),
};
