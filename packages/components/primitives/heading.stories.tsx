import type { Meta, StoryObj } from "@storybook/react-vite";

import { Heading } from "./heading";
import { Stack } from "./stack";

const meta = {
  title: "Primitives/Heading",
  component: Heading,
  parameters: { layout: "padded" },
  args: { children: "Section heading" },
  argTypes: {
    level: { control: "select", options: [1, 2, 3, 4] },
    size: { control: "select", options: ["sm", "md", "lg", "xl"] },
    tone: { control: "select", options: ["default", "muted"] },
  },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const PageTitle: Story = { args: { level: 1, size: "xl" } };

export const SizeScale: Story = {
  render: () => (
    <Stack direction="column" gap="md">
      {(["sm", "md", "lg", "xl"] as const).map((size) => (
        <Heading key={size} size={size}>
          {size} heading
        </Heading>
      ))}
    </Stack>
  ),
};
