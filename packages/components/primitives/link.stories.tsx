import type { Meta, StoryObj } from "@storybook/react-vite";

import { Link } from "./link";
import { Stack } from "./stack";

const meta = {
  title: "Primitives/Link",
  component: Link,
  parameters: { layout: "centered" },
  args: { href: "#", children: "View organization" },
  argTypes: {
    tone: { control: "select", options: ["default", "muted", "primary", "inherit"] },
    underline: { control: "select", options: ["none", "hover", "always"] },
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Muted: Story = { args: { tone: "muted", underline: "none" } };
export const AlwaysUnderlined: Story = { args: { underline: "always" } };

export const ToneScale: Story = {
  render: () => (
    <Stack direction="column" gap="sm">
      {(["default", "muted", "primary"] as const).map((tone) => (
        <Link key={tone} href="#" tone={tone}>
          {tone}
        </Link>
      ))}
    </Stack>
  ),
};
