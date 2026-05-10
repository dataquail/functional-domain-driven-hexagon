import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  argTypes: {
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Disabled: Story = { args: { disabled: true } };

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
};

// Play-test: clicking the label toggles the associated checkbox.
// Confirms the htmlFor / id contract the rest of the design system
// relies on (Form.Control wires labels by id).
export const ToggleViaLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="play-terms" />
      <Label htmlFor="play-terms">Accept terms and conditions</Label>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: /accept terms/i });

    // Radix renders a button with aria-checked instead of a real
    // input[type=checkbox]; both states are exposed via getByRole.
    await expect(checkbox).toHaveAttribute("aria-checked", "false");

    await userEvent.click(canvas.getByText("Accept terms and conditions"));
    await expect(checkbox).toHaveAttribute("aria-checked", "true");

    await userEvent.click(canvas.getByText("Accept terms and conditions"));
    await expect(checkbox).toHaveAttribute("aria-checked", "false");
  },
};
