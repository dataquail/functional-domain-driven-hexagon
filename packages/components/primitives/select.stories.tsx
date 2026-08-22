import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Select, type SelectTriggerWidth } from "./select";

const FRUITS = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "blueberry", label: "Blueberry" },
] as const;

// Selection is a prop, so in the app it is an atom in a ViewModel; a story holds
// the equivalent locally.
const ControlledSelect: React.FC<{ readonly width?: SelectTriggerWidth }> = ({ width = "md" }) => {
  const [value, setValue] = React.useState<string | undefined>(undefined);
  return (
    <Select value={value} onValueChange={setValue}>
      <Select.Trigger width={width} data-testid="fruit-select">
        <Select.Value placeholder="Pick a fruit…" />
      </Select.Trigger>
      <Select.Content>
        {FRUITS.map((fruit) => (
          <Select.Item key={fruit.value} value={fruit.value}>
            {fruit.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
};

const meta = {
  title: "Primitives/Select",
  component: Select,
  parameters: { layout: "centered" },
  args: { onValueChange: () => undefined },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <ControlledSelect /> };
export const FullWidth: Story = { render: () => <ControlledSelect width="full" /> };

// Play-test: opening the listbox and choosing an option updates the trigger's
// displayed value — the contract the org switcher depends on.
export const ChooseAnOption: Story = {
  render: () => <ControlledSelect />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("fruit-select");
    await expect(trigger).toHaveTextContent("Pick a fruit…");

    await userEvent.click(trigger);

    // Radix portals the listbox outside the canvas element.
    const listbox = await within(document.body).findByRole("listbox");
    await userEvent.click(within(listbox).getByText("Blueberry"));

    await waitFor(async () => {
      await expect(trigger).toHaveTextContent("Blueberry");
    });
  },
};
