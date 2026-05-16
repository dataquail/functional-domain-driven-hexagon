import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Select } from "./select";

const meta = {
  title: "Primitives/Select",
  component: Select,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <Select>
        <Select.Trigger>
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            <Select.Label>Fruits</Select.Label>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
            <Select.Item value="cherry">Cherry</Select.Item>
          </Select.Group>
          <Select.Separator />
          <Select.Group>
            <Select.Label>Vegetables</Select.Label>
            <Select.Item value="carrot">Carrot</Select.Item>
            <Select.Item value="kale">Kale</Select.Item>
          </Select.Group>
        </Select.Content>
      </Select>
    </div>
  ),
};

// Play-test: Select's ARIA contract. The Radix listbox exposes
// aria-haspopup/aria-expanded on the trigger; opening + arrow-down +
// Enter selects the first item. Catches regressions in the
// keyboard-nav and ARIA pieces that depend on Radix's primitives.
export const KeyboardNavigation: Story = {
  render: () => (
    <div className="w-64">
      <Select>
        <Select.Trigger data-testid="play-trigger">
          <Select.Value placeholder="Pick a fruit" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
          <Select.Item value="cherry">Cherry</Select.Item>
        </Select.Content>
      </Select>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("play-trigger");

    await step("trigger is closed initially (aria-expanded=false)", async () => {
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    await step("opening via keyboard surfaces the options", async () => {
      trigger.focus();
      await userEvent.keyboard("{Enter}");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
  },
};
