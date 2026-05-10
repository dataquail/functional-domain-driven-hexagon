import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  parameters: { layout: "centered" },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search"],
    },
    disabled: { control: "boolean" },
  },
  args: { placeholder: "Type something…" },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Email: Story = { args: { type: "email", placeholder: "user@example.com" } };
export const Password: Story = { args: { type: "password", placeholder: "••••••••" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "Read only" } };
export const Invalid: Story = { args: { defaultValue: "bad", "aria-invalid": true } };
