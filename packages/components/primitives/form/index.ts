import Input from "../input.svelte";
import Label from "../label.svelte";
import Select from "../select.svelte";
import FormRoot from "./form.svelte";
import FormControl from "./form-control.part.svelte";
import FieldError from "./form-error.part.svelte";

export type { FormProps } from "./form.svelte";
export type { FormControlProps } from "./form-control.part.svelte";
export type { FieldErrorProps } from "./form-error.part.svelte";

export const Form = Object.assign(FormRoot, {
  Input,
  Select,
  Control: FormControl,
  Label,
  Error: FieldError,
});
