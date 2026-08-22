import type { Meta, StoryObj } from "@storybook/react-vite";

import { Skeleton } from "./skeleton";
import { Stack } from "./stack";

const meta = {
  title: "Primitives/Skeleton",
  component: Skeleton,
  parameters: { layout: "padded" },
  argTypes: {
    height: { control: "select", options: ["text", "control", "row", "card"] },
    width: { control: "select", options: ["full", "half", "switcher"] },
    radius: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// The scale is named after what each size stands in for, so a fallback matches
// the height of the real thing instead of guessing at one.
export const HeightScale: Story = {
  render: () => (
    <Stack direction="column" gap="sm">
      {(["text", "control", "row", "card"] as const).map((height) => (
        <Skeleton key={height} height={height} />
      ))}
    </Stack>
  ),
};

export const ListFallback: Story = {
  render: () => (
    <Stack direction="column" gap="sm">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} height="row" />
      ))}
    </Stack>
  ),
};
