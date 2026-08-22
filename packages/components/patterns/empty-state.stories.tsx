import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../primitives/button";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Patterns/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
  args: { message: "No users yet." },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHint: Story = {
  args: { hint: "Users you invite will appear here." },
};
export const WithAction: Story = {
  args: {
    hint: "Users you invite will appear here.",
    action: <Button size="sm">Invite someone</Button>,
  },
};
