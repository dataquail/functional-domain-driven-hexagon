import { cn } from "../lib/utils/cn";

// A text field. The prop surface is what a form actually needs, not the whole
// `<input>` element: no `className`, no DOM spread, and no `type` values the
// design system has not agreed to render.

export type InputType = "text" | "email" | "password" | "search" | "tel" | "url";

export type InputProps = {
  readonly id?: string;
  readonly name?: string;
  readonly type?: InputType;
  readonly value: string;
  readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly autoComplete?: string;
  readonly invalid?: boolean;
  readonly "aria-label"?: string;
  readonly "data-testid"?: string;
};

const Input: React.FC<InputProps> = ({
  "aria-label": ariaLabel,
  autoComplete,
  "data-testid": testId,
  disabled = false,
  id,
  invalid = false,
  name,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}) => (
  <input
    id={id}
    name={name}
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    required={required}
    autoComplete={autoComplete}
    aria-invalid={invalid || undefined}
    aria-label={ariaLabel}
    data-slot="input"
    data-testid={testId}
    className={cn(
      "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    )}
  />
);

export { Input };
