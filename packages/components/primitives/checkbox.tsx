import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { CheckIcon } from "./icon";

// A checkbox. Radix owns the keyboard and ARIA behaviour; this file owns which
// of its props a screen is allowed to reach.

export type CheckboxProps = {
  readonly id?: string;
  readonly name?: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly "aria-label"?: string;
  readonly "data-testid"?: string;
};

const Checkbox: React.FC<CheckboxProps> = ({
  "aria-label": ariaLabel,
  checked,
  "data-testid": testId,
  disabled = false,
  id,
  name,
  onCheckedChange,
}) => (
  <CheckboxPrimitive.Root
    id={id}
    name={name}
    checked={checked}
    onCheckedChange={(next) => {
      onCheckedChange(next === true);
    }}
    disabled={disabled}
    aria-label={ariaLabel}
    data-slot="checkbox"
    data-testid={testId}
    className="peer size-4 shrink-0 rounded-sm border border-primary shadow focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <CheckIcon size="md" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);

export { Checkbox };
