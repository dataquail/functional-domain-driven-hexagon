import type { Meta, StoryObj } from "@storybook/react-vite";

import { Text } from "../primitives/text";
import { CardSection } from "./card-section";
import { PageShell } from "./page-shell";

const meta = {
  title: "Patterns/PageShell",
  component: PageShell,
  parameters: { layout: "fullscreen" },
  args: {
    children: (
      <CardSection title="A section">
        <Text>Section body</Text>
      </CardSection>
    ),
  },
  argTypes: {
    width: { control: "select", options: ["xs", "sm", "md", "lg", "full"] },
  },
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Narrow: Story = { args: { width: "xs" } };

export const StackedSections: Story = {
  render: (args) => (
    <PageShell {...args}>
      <CardSection title="Create user">
        <Text>A form would go here.</Text>
      </CardSection>
      <CardSection title="Users">
        <Text>A list would go here.</Text>
      </CardSection>
    </PageShell>
  ),
};
