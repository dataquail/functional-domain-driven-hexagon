import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { Grid } from "./grid";
import { Surface } from "./surface";
import { Text } from "./text";

const Cell = ({ label }: { label: string }) => (
  <Surface tone="muted" radius="md" padding="md">
    <Text>{label}</Text>
  </Surface>
);

const meta = {
  title: "Primitives/Grid",
  component: Grid,
  parameters: { layout: "padded" },
  args: {
    columnsAbove: 2,
    gap: "md",
    children: (
      <React.Fragment>
        <Grid.Item>
          <Cell label="Email" />
        </Grid.Item>
        <Grid.Item>
          <Cell label="Country" />
        </Grid.Item>
        <Grid.Item spanAbove={2}>
          <Cell label="Street (full width)" />
        </Grid.Item>
      </React.Fragment>
    ),
  },
  argTypes: {
    columnsAbove: { control: "select", options: [1, 2, 3, 4] },
    gap: { control: "select", options: ["none", "sm", "md", "lg"] },
  },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One column on small screens, two from `sm` up. */
export const FormRows: Story = {};
export const ThreeUp: Story = { args: { columnsAbove: 3 } };
