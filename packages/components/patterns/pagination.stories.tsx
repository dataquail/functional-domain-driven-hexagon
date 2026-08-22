import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Pagination } from "./pagination";

const meta = {
  title: "Patterns/Pagination",
  component: Pagination,
  parameters: { layout: "padded" },
  args: {
    page: 2,
    totalPages: 5,
    total: 47,
    hasPrevious: true,
    hasNext: true,
    itemLabel: "users",
    onPrevious: fn(),
    onNext: fn(),
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Middle: Story = {};
export const FirstPage: Story = { args: { page: 1, hasPrevious: false } };
export const LastPage: Story = { args: { page: 5, hasNext: false } };
export const SinglePage: Story = {
  args: { page: 1, totalPages: 1, total: 3, hasPrevious: false, hasNext: false },
};
