import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Card } from "./card";

const meta = {
  title: "Primitives/Card",
  component: Card,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <Card.Header>
        <Card.Title>Card title</Card.Title>
        <Card.Description>A short description of the card.</Card.Description>
      </Card.Header>
      <Card.Content>
        <p className="text-sm">Card body content lives here.</p>
      </Card.Content>
      <Card.Footer className="justify-end gap-2">
        <Button variant="ghost">Cancel</Button>
        <Button>Save</Button>
      </Card.Footer>
    </Card>
  ),
};
