import type { Meta, StoryObj } from "@storybook/react-vite";
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
