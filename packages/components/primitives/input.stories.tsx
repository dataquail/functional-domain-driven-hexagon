import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";

import { Container } from "./container";
import { Input, type InputProps } from "./input";

// `Input` is strictly controlled — in the app the value is an atom in the
// feature's ViewModel, so a story holds the equivalent locally.
const ControlledInput: React.FC<Omit<InputProps, "value" | "onChange">> = (props) => {
  const [value, setValue] = React.useState("");
  return (
    <Container width="xs" paddingX="none">
      <Input
        {...props}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
    </Container>
  );
};

const meta = {
  title: "Primitives/Input",
  component: Input,
  parameters: { layout: "centered" },
  args: { value: "", onChange: () => undefined, placeholder: "Type something…" },
  argTypes: {
    type: { control: "select", options: ["text", "email", "password", "search", "tel", "url"] },
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Email: Story = { args: { type: "email", placeholder: "user@example.com" } };
export const Password: Story = { args: { type: "password", placeholder: "••••••••" } };
export const Disabled: Story = { args: { disabled: true, value: "Read only" } };
export const Invalid: Story = { args: { value: "bad", invalid: true } };

// Play-test: keyboard input lands in the input's value.
export const TypeViaKeyboard: Story = {
  render: () => <ControlledInput placeholder="Type here…" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText<HTMLInputElement>("Type here…");
    await userEvent.type(input, "hello");
    await expect(input.value).toBe("hello");
  },
};
