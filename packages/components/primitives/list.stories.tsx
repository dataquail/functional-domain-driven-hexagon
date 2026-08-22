import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { List } from "./list";
import { Surface } from "./surface";
import { Text } from "./text";

const meta = {
  title: "Primitives/List",
  component: List,
  parameters: { layout: "padded" },
  args: {
    gap: "sm",
    children: (
      <React.Fragment>
        <List.Item>
          <Text>First</Text>
        </List.Item>
        <List.Item>
          <Text>Second</Text>
        </List.Item>
        <List.Item>
          <Text>Third</Text>
        </List.Item>
      </React.Fragment>
    ),
  },
  argTypes: {
    as: { control: "select", options: ["ul", "ol"] },
    gap: { control: "select", options: ["none", "xs", "sm", "md"] },
    marker: { control: "select", options: ["none", "disc"] },
  },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Bulleted: Story = { args: { marker: "disc" } };
export const Ordered: Story = { args: { as: "ol", marker: "disc" } };

/** Rows get their chrome from Surface, not from List. */
export const WithSurfaceRows: Story = {
  render: () => (
    <List gap="sm">
      {["Ada Lovelace", "Grace Hopper", "Katherine Johnson"].map((name) => (
        <List.Item key={name}>
          <Surface tone="card" radius="md" border="all" padding="md" interactive="raise">
            <Text weight="medium">{name}</Text>
          </Surface>
        </List.Item>
      ))}
    </List>
  ),
};
