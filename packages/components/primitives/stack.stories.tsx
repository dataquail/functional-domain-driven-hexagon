import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { Stack } from "./stack";

const Box = ({ label }: { label: string }) => (
  <div className="rounded-md bg-primary/10 px-3 py-2 text-sm">{label}</div>
);

const meta = {
  title: "Primitives/Stack",
  component: Stack,
  parameters: { layout: "padded" },
  args: {
    gap: "md",
    children: (
      <React.Fragment>
        <Box label="One" />
        <Box label="Two" />
        <Box label="Three" />
      </React.Fragment>
    ),
  },
  argTypes: {
    direction: { control: "select", options: ["row", "column"] },
    directionAbove: { control: "select", options: [undefined, "row", "column"] },
    gap: { control: "select", options: ["none", "xs", "sm", "md", "lg", "xl"] },
    align: { control: "select", options: ["start", "center", "end", "stretch", "baseline"] },
    justify: { control: "select", options: ["start", "center", "end", "between", "around"] },
  },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Column: Story = {};
export const Row: Story = { args: { direction: "row" } };
export const RowSpaceBetween: Story = { args: { direction: "row", justify: "between" } };
export const RowCentered: Story = { args: { direction: "row", align: "center", gap: "sm" } };
/** Stacks on mobile, lays out in a row from the `sm` breakpoint up. */
export const ResponsiveDirection: Story = {
  args: { direction: "column", directionAbove: "row", justify: "between" },
};
export const GapScale: Story = {
  render: () => (
    <Stack direction="column" gap="lg">
      {(["none", "xs", "sm", "md", "lg", "xl"] as const).map((gap) => (
        <Stack key={gap} direction="row" gap={gap} align="center">
          <Box label={gap} />
          <Box label="•" />
          <Box label="•" />
        </Stack>
      ))}
    </Stack>
  ),
};
