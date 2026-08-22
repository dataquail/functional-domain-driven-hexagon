import type { Meta, StoryObj } from "@storybook/react-vite";

import { Container } from "./container";
import { Surface } from "./surface";
import { Text } from "./text";

const meta = {
  title: "Primitives/Container",
  component: Container,
  parameters: { layout: "fullscreen" },
  args: {
    children: (
      <Surface tone="muted" radius="md" padding="md">
        <Text>Page content</Text>
      </Surface>
    ),
  },
  argTypes: {
    width: { control: "select", options: ["xs", "sm", "md", "lg", "full"] },
    paddingX: { control: "select", options: ["none", "md"] },
    paddingY: { control: "select", options: ["none", "xs", "sm", "lg"] },
  },
} satisfies Meta<typeof Container>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Narrow: Story = { args: { width: "sm" } };
export const Wide: Story = { args: { width: "lg", paddingY: "lg" } };
export const NavBarWidth: Story = { args: { width: "lg", paddingY: "sm" } };
