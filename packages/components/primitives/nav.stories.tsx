import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { Link } from "./link";
import { Nav } from "./nav";

const meta = {
  title: "Primitives/Nav",
  component: Nav,
  parameters: { layout: "fullscreen" },
  args: {
    "aria-label": "Main",
    children: (
      <React.Fragment>
        <Link href="#" tone="muted">
          Todos
        </Link>
        <Link href="#" tone="muted">
          Users
        </Link>
        <Link href="#" tone="muted">
          Organizations
        </Link>
      </React.Fragment>
    ),
  },
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
    tone: { control: "select", options: ["none", "bar"] },
  },
} satisfies Meta<typeof Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};
export const AppBar: Story = { args: { tone: "bar" } };
export const Vertical: Story = { args: { orientation: "vertical" } };
