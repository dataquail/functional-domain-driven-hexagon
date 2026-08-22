import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Reveal } from "./reveal";
import { Stack } from "./stack";
import { Surface } from "./surface";
import { Text } from "./text";

const meta = {
  title: "Primitives/Reveal",
  component: Reveal,
  parameters: { layout: "padded" },
  args: { children: <Button variant="ghost">Delete</Button> },
} satisfies Meta<typeof Reveal>;

export default meta;
type Story = StoryObj<typeof meta>;

// On its own there is no `group` ancestor, so the control is reachable by
// keyboard but invisible to the mouse -- which is the misuse worth showing.
export const WithoutAGroup: Story = {};

export const InsideAHoverGroup: Story = {
  render: () => (
    <Surface hoverGroup tone="card" radius="md" border="all" padding="md">
      <Stack direction="row" align="center" justify="between">
        <Text>Hover this row</Text>
        <Reveal>
          <Button variant="ghost">Delete</Button>
        </Reveal>
      </Stack>
    </Surface>
  ),
};
