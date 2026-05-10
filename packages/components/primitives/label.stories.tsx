import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Primitives/Label",
  component: Label,
  parameters: { layout: "centered" },
  args: { children: "Email" },
  argTypes: {
    required: { control: "boolean" },
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Required: Story = { args: { required: true } };

export const WithInput: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="email" required>
        Email
      </Label>
      <Input id="email" type="email" placeholder="user@example.com" />
    </div>
  ),
};
