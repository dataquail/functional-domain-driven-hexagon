import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { Input } from "./input";
import { Label } from "./label";
import { Stack } from "./stack";

const meta = {
  title: "Primitives/Label",
  component: Label,
  parameters: { layout: "centered" },
  args: { children: "Email" },
  argTypes: {
    required: { control: "boolean" },
    tone: { control: "select", options: ["default", "muted"] },
    decoration: { control: "select", options: ["none", "line-through"] },
    truncate: { control: "boolean" },
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Required: Story = { args: { required: true } };

// What a completed to-do's label looks like.
export const StruckThrough: Story = {
  args: { tone: "muted", decoration: "line-through", children: "Buy milk" },
};

const LabelledInput: React.FC = () => {
  const [value, setValue] = React.useState("");
  return (
    <Stack direction="column" gap="xs">
      <Label htmlFor="email" required>
        Email
      </Label>
      <Input
        id="email"
        type="email"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        placeholder="user@example.com"
      />
    </Stack>
  );
};

export const WithInput: Story = { render: () => <LabelledInput /> };
