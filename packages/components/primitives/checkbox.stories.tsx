import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";

import { Checkbox } from "./checkbox";
import { Label } from "./label";
import { Stack } from "./stack";

// Stories drive the controlled prop themselves; in the app that state is an
// atom in the feature's ViewModel.
const ControlledCheckbox: React.FC<{
  readonly id: string;
  readonly label: string;
  readonly initial?: boolean;
  readonly disabled?: boolean;
}> = ({ disabled = false, id, initial = false, label }) => {
  const [checked, setChecked] = React.useState(initial);
  return (
    <Stack direction="row" gap="sm" align="center">
      <Checkbox id={id} checked={checked} onCheckedChange={setChecked} disabled={disabled} />
      <Label htmlFor={id}>{label}</Label>
    </Stack>
  );
};

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  args: { checked: false, onCheckedChange: () => undefined },
  argTypes: {
    disabled: { control: "boolean" },
    checked: { control: "boolean" },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Checked: Story = { args: { checked: true } };
export const Disabled: Story = { args: { disabled: true } };

export const WithLabel: Story = {
  render: () => <ControlledCheckbox id="terms" label="Accept terms and conditions" />,
};

// Play-test: clicking the label toggles the associated checkbox. Confirms the
// htmlFor / id contract the rest of the design system relies on.
export const ToggleViaLabel: Story = {
  render: () => <ControlledCheckbox id="play-terms" label="Accept terms and conditions" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: /accept terms/i });

    // Radix renders a button with aria-checked rather than a real
    // input[type=checkbox]; both states are exposed via getByRole.
    await expect(checkbox).toHaveAttribute("aria-checked", "false");

    await userEvent.click(canvas.getByText("Accept terms and conditions"));
    await expect(checkbox).toHaveAttribute("aria-checked", "true");

    await userEvent.click(canvas.getByText("Accept terms and conditions"));
    await expect(checkbox).toHaveAttribute("aria-checked", "false");
  },
};
