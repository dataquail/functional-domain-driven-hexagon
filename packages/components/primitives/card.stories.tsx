import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Card } from "./card";
import { Heading } from "./heading";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
  title: "Primitives/Card",
  component: Card,
  parameters: { layout: "padded" },
  args: {
    children: (
      <Card.Content>
        <Text>Card body content lives here.</Text>
      </Card.Content>
    ),
  },
  argTypes: {
    elevation: { control: "select", options: ["none", "sm", "md"] },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Raised: Story = { args: { elevation: "md" } };

// A title is a `Heading` and a description is `Text` — the card owns chrome,
// the typography primitives own type.
export const Titled: Story = {
  render: (args) => (
    <Card {...args}>
      <Card.Header>
        <Heading level={2} size="lg">
          Card title
        </Heading>
        <Text tone="muted">A short description of the card.</Text>
      </Card.Header>
      <Card.Content gap="md">
        <Text>Card body content lives here.</Text>
      </Card.Content>
      <Card.Footer>
        <Stack direction="row" gap="sm" justify="end" width="full">
          <Button variant="ghost">Cancel</Button>
          <Button>Save</Button>
        </Stack>
      </Card.Footer>
    </Card>
  ),
};
