import * as SelectPrimitive from "@radix-ui/react-select";

import { cn } from "../lib/utils/cn";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "./icon";

// A single-select. Radix owns the popover, keyboard model and ARIA; this file
// owns which of it a screen may address. The scroll buttons and the item
// indicator are chrome, not choices, so they are not props.

export type SelectTriggerWidth = "auto" | "full" | "sm" | "md" | "lg";

const TRIGGER_WIDTH: Record<SelectTriggerWidth, string> = {
  auto: "w-auto",
  full: "w-full",
  sm: "w-40",
  md: "w-50",
  lg: "w-70",
};

export type SelectProps = {
  readonly value?: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly children?: React.ReactNode;
};

const SelectRoot: React.FC<SelectProps> = ({
  children,
  disabled = false,
  onValueChange,
  value,
}) => (
  <SelectPrimitive.Root
    value={value}
    onValueChange={onValueChange}
    disabled={disabled}
    data-slot="select"
  >
    {children}
  </SelectPrimitive.Root>
);

export type SelectTriggerProps = {
  readonly width?: SelectTriggerWidth;
  readonly children?: React.ReactNode;
  readonly "aria-label"?: string;
  readonly "data-testid"?: string;
};

const SelectTrigger: React.FC<SelectTriggerProps> = ({
  "aria-label": ariaLabel,
  children,
  "data-testid": testId,
  width = "full",
}) => (
  <SelectPrimitive.Trigger
    aria-label={ariaLabel}
    data-slot="select-trigger"
    data-testid={testId}
    className={cn(
      TRIGGER_WIDTH[width],
      "flex h-9 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1",
    )}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon size="md" tone="muted" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
);

const SelectValue: React.FC<{ readonly placeholder?: string }> = ({ placeholder }) => (
  <SelectPrimitive.Value data-slot="select-value" placeholder={placeholder} />
);

const SCROLL_BUTTON = "flex cursor-default items-center justify-center py-1";

const SelectContent: React.FC<{ readonly children?: React.ReactNode }> = ({ children }) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      data-slot="select-content"
      position="popper"
      className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
    >
      <SelectPrimitive.ScrollUpButton className={SCROLL_BUTTON}>
        <ChevronUpIcon size="md" tone="muted" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] p-1">
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className={SCROLL_BUTTON}>
        <ChevronDownIcon size="md" tone="muted" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);

export type SelectItemProps = {
  readonly value: string;
  readonly disabled?: boolean;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const SelectItem: React.FC<SelectItemProps> = ({
  children,
  "data-testid": testId,
  disabled = false,
  value,
}) => (
  <SelectPrimitive.Item
    value={value}
    disabled={disabled}
    data-slot="select-item"
    data-testid={testId}
    className="relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon size="md" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
);

const Select = Object.assign(SelectRoot, {
  Trigger: SelectTrigger,
  Value: SelectValue,
  Content: SelectContent,
  Item: SelectItem,
});

export { Select };
