import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
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

// Play-test: keyboard input lands in the input's value.
export const TypeViaKeyboard: Story = {
  args: { placeholder: "Type here…" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText<HTMLInputElement>("Type here…");
    await userEvent.type(input, "hello");
    await expect(input.value).toBe("hello");
  },
};
