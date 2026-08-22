import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { TrashIcon } from "../primitives/icon";
import { List } from "../primitives/list";
import { Text } from "../primitives/text";
import { ListRow } from "./list-row";

const meta = {
  title: "Patterns/ListRow",
  component: ListRow,
  parameters: { layout: "padded" },
  args: {
    children: <Text weight="medium">Buy milk</Text>,
    leading: <Checkbox id="story-row" checked={false} onCheckedChange={() => undefined} />,
    trailing: (
      <Button variant="ghost" size="icon">
        <TrashIcon tone="destructive" />
        <Text as="span" srOnly>
          Delete
        </Text>
      </Button>
    ),
  },
  argTypes: {
    revealTrailing: { control: "boolean" },
  },
} satisfies Meta<typeof ListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const RevealsTrailingOnHover: Story = { args: { revealTrailing: true } };

export const InAList: Story = {
  render: (args) => (
    <List gap="sm">
      {["Buy milk", "Walk the dog", "Write the ADR"].map((title) => (
        <List.Item key={title}>
          <ListRow {...args}>
            <Text weight="medium">{title}</Text>
          </ListRow>
        </List.Item>
      ))}
    </List>
  ),
};
