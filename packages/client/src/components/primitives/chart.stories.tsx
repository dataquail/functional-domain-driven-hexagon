import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart";

const data = [
  { month: "Jan", desktop: 186, mobile: 80 },
  { month: "Feb", desktop: 305, mobile: 200 },
  { month: "Mar", desktop: 237, mobile: 120 },
  { month: "Apr", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "Jun", desktop: 214, mobile: 140 },
];

const config = {
  desktop: { label: "Desktop", color: "hsl(220 70% 50%)" },
  mobile: { label: "Mobile", color: "hsl(160 60% 45%)" },
} satisfies ChartConfig;

const BarDemo = () => (
  <ChartContainer config={config} className="h-64 w-[480px]">
    <BarChart data={data}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="month" tickLine={false} axisLine={false} />
      <ChartTooltip content={<ChartTooltipContent />} />
      <ChartLegend content={<ChartLegendContent />} />
      <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
      <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
    </BarChart>
  </ChartContainer>
);

const meta = {
  title: "Primitives/Chart",
  component: BarDemo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof BarDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BarExample: Story = {};
