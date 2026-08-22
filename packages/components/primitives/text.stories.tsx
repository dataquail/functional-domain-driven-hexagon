import type { Meta, StoryObj } from "@storybook/react-vite";

import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
  title: "Primitives/Text",
  component: Text,
  parameters: { layout: "padded" },
  args: { children: "The quick brown fox jumps over the lazy dog." },
  argTypes: {
    as: { control: "select", options: ["p", "span", "div"] },
    size: { control: "select", options: ["xs", "sm", "base", "lg"] },
    tone: { control: "select", options: ["default", "muted", "destructive", "inherit"] },
    weight: { control: "select", options: ["normal", "medium", "semibold"] },
    align: { control: "select", options: ["start", "center", "end"] },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Muted: Story = { args: { tone: "muted", size: "xs" } };
export const Destructive: Story = { args: { tone: "destructive" } };
export const Emphasis: Story = { args: { weight: "medium" } };

export const SizeScale: Story = {
  render: () => (
    <Stack direction="column" gap="sm">
      {(["xs", "sm", "base", "lg"] as const).map((size) => (
        <Text key={size} size={size}>
          {size} — the quick brown fox
        </Text>
      ))}
    </Stack>
  ),
};

export const ToneScale: Story = {
  render: () => (
    <Stack direction="column" gap="sm">
      {(["default", "muted", "destructive"] as const).map((tone) => (
        <Text key={tone} tone={tone}>
          {tone} — the quick brown fox
        </Text>
      ))}
    </Stack>
  ),
};

/** Truncation only bites inside a container allowed to shrink below its content. */
export const Truncated: Story = {
  render: () => (
    <Stack direction="row" gap="sm" shrinkBelowContent>
      <Text truncate>
        A single line of text far too long for its container, which therefore ends in an ellipsis
        rather than wrapping onto a second line.
      </Text>
    </Stack>
  ),
};
