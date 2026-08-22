import type { Meta, StoryObj } from "@storybook/react-vite";

import { Stack } from "./stack";
import { Surface } from "./surface";
import { Text } from "./text";

const meta = {
  title: "Primitives/Surface",
  component: Surface,
  parameters: { layout: "padded" },
  args: {
    tone: "card",
    radius: "md",
    border: "all",
    padding: "md",
    children: <Text>Surface content</Text>,
  },
  argTypes: {
    tone: { control: "select", options: ["none", "card", "muted", "subtle"] },
    radius: { control: "select", options: ["none", "md", "lg", "full"] },
    border: { control: "select", options: ["none", "all", "top", "bottom"] },
    padding: { control: "select", options: ["none", "sm", "md", "lg"] },
    interactive: { control: "select", options: ["none", "raise", "highlight"] },
  },
} satisfies Meta<typeof Surface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Card: Story = {};
export const Muted: Story = { args: { tone: "muted", border: "none", radius: "lg" } };
export const Raises: Story = { args: { interactive: "raise" } };
export const Highlights: Story = { args: { interactive: "highlight", tone: "none" } };

export const ToneScale: Story = {
  render: () => (
    <Stack direction="column" gap="sm">
      {(["none", "card", "muted", "subtle"] as const).map((tone) => (
        <Surface key={tone} tone={tone} radius="md" border="all" padding="md">
          <Text>{tone}</Text>
        </Surface>
      ))}
    </Stack>
  ),
};
