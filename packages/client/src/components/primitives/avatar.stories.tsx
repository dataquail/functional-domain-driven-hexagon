import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./avatar";

const meta = {
  title: "Primitives/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <Avatar.Image src="https://i.pravatar.cc/96?img=12" alt="User" />
      <Avatar.Fallback>U</Avatar.Fallback>
    </Avatar>
  ),
};

export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <Avatar.Image src="" alt="" />
      <Avatar.Fallback>ZW</Avatar.Fallback>
    </Avatar>
  ),
};
