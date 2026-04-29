import type { Meta, StoryObj } from "@storybook/react-vite";
import type { IconProps } from "./icon";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "./icons";

const All = (props: IconProps) => (
  <div className="flex items-center gap-4">
    <PlusIcon {...props} />
    <TrashIcon {...props} />
    <ChevronLeftIcon {...props} />
    <ChevronRightIcon {...props} />
  </div>
);

const meta = {
  title: "Primitives/Icon",
  component: All,
  parameters: { layout: "centered" },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    tone: { control: "select", options: ["default", "muted", "destructive", "inherit"] },
  },
} satisfies Meta<typeof All>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Muted: Story = { args: { tone: "muted" } };
export const Destructive: Story = { args: { tone: "destructive" } };
