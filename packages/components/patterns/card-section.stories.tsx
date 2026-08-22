import type { Meta, StoryObj } from "@storybook/react-vite";

import { Link } from "../primitives/link";
import { Text } from "../primitives/text";
import { CardSection } from "./card-section";

const meta = {
  title: "Patterns/CardSection",
  component: CardSection,
  parameters: { layout: "padded" },
  args: {
    title: "Organization members",
    children: <Text>Section body</Text>,
  },
  argTypes: {
    titleSize: { control: "select", options: ["sm", "md", "lg", "xl"] },
    titleAlign: { control: "select", options: ["start", "center"] },
    headerPadding: { control: "select", options: ["default", "tight"] },
  },
} satisfies Meta<typeof CardSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Centered: Story = { args: { titleAlign: "center", title: "My Tasks" } };
export const Secondary: Story = { args: { titleSize: "lg", title: "Pending invitations" } };

export const WithAction: Story = {
  args: {
    action: (
      <Link href="#" appearance="button" underline="none" tone="default">
        + Invite user
      </Link>
    ),
  },
};
