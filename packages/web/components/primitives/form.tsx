import { cn } from "@/lib/utils/cn";
import * as String from "effect/String";
import React from "react";
import { Input } from "./input";
import { Label } from "./label";
import { Select } from "./select";

const FormControl: React.FC<React.ComponentProps<"div">> = ({ children, ...props }) => {
  return (
    <div className="flex flex-col gap-1.5" {...props}>
      {children}
    </div>
  );
};

const FieldError: React.FC<
  Omit<React.ComponentProps<"span">, "children"> & {
    error?: string | null | undefined;
  }
> = ({ className, error = null, ...props }) => {
  if (error === null || String.isEmpty(error)) return null;

  return (
    <span className={cn("text-sm text-red-500 dark:text-red-400", className)} {...props}>
      {error}
    </span>
  );
};

export const Form: React.FC<React.ComponentProps<"form">> & {
  Input: typeof Input;
  Select: typeof Select;
  Control: typeof FormControl;
  Label: typeof Label;
  Error: typeof FieldError;
} = ({ children, className, onSubmit, ...props }) => {
  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSubmit?.(event);
      }}
      {...props}
    >
      {children}
    </form>
  );
};

Form.Input = Input;
Form.Select = Select;
Form.Control = FormControl;
Form.Label = Label;
Form.Error = FieldError;
