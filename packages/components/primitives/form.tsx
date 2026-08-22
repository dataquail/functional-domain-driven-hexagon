import * as String from "effect/String";

import { cn } from "../lib/utils/cn";
import { Input } from "./input";
import { Label } from "./label";
import { Select } from "./select";

// A form and the two wrappers a field needs. `onSubmit` takes no event: the
// primitive has already prevented the default and stopped propagation, so a
// screen says *what to do*, never *what not to let the browser do*.

const FormControl: React.FC<{ readonly children?: React.ReactNode }> = ({ children }) => (
  <div data-slot="form-control" className="flex flex-col gap-1.5">
    {children}
  </div>
);

export type FieldErrorProps = {
  readonly error?: string | null | undefined;
  readonly "data-testid"?: string;
};

const FieldError: React.FC<FieldErrorProps> = ({ "data-testid": testId, error = null }) => {
  if (error === null || String.isEmpty(error)) return null;

  return (
    <span
      role="alert"
      data-slot="form-error"
      data-testid={testId}
      className="text-sm text-destructive"
    >
      {error}
    </span>
  );
};

export type FormProps = {
  readonly onSubmit: () => void;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const FormRoot: React.FC<FormProps> = ({ children, "data-testid": testId, onSubmit }) => (
  <form
    data-slot="form"
    data-testid={testId}
    className={cn("flex flex-col gap-4")}
    onSubmit={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onSubmit();
    }}
  >
    {children}
  </form>
);

const Form = Object.assign(FormRoot, {
  Input,
  Select,
  Control: FormControl,
  Label,
  Error: FieldError,
});

export { Form };
