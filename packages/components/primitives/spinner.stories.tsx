import type { Meta, StoryObj } from "@storybook/react-vite";

import { Spinner } from "./spinner";
import { Stack } from "./stack";

const meta = {
  title: "Primitives/Spinner",
  component: Spinner,
  parameters: { layout: "centered" },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    tone: { control: "select", options: ["default", "muted", "inherit"] },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SizeScale: Story = {
  render: () => (
    <Stack direction="row" gap="lg" align="center">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Spinner key={size} size={size} />
      ))}
    </Stack>
  ),
};
