import { waitFor, within } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";

import type {
  CreateUserField,
  CreateUserInput,
  ToastKind,
  UsersPageDriver,
} from "../../contracts/users-page-driver.ts";

const testIdByField: Record<CreateUserField, string> = {
  email: "create-user-email",
  country: "create-user-country",
  street: "create-user-street",
  postalCode: "create-user-postal-code",
};

const missing = (message: string): never => {
  throw new Error(message);
};

// `rendered` is what `@testing-library/svelte`'s `render(...)` returns; only
// its container is read, so the adapter pins no component type or wrapper.
export const svelteUsersDriver = (rendered: {
  readonly container: HTMLElement;
}): UsersPageDriver => {
  const user = userEvent.setup();
  // svelte-sonner's <Toaster /> renders to document.body, outside the
  // container, so toasts are found by their stable attributes on document.
  const formScope = within(rendered.container);

  const fieldInput = (field: CreateUserField) => formScope.getByTestId(testIdByField[field]);

  return {
    goto: async () => {
      // RTL doesn't navigate; the caller already mounted the page.
      // Assert that the form is ready so subsequent interactions
      // have something to drive.
      await waitFor(() => {
        formScope.getByTestId("create-user-email");
      });
    },

    createUser: async (input: CreateUserInput) => {
      await user.clear(fieldInput("email"));
      await user.type(fieldInput("email"), input.email);
      await user.clear(fieldInput("country"));
      await user.type(fieldInput("country"), input.country);
      await user.clear(fieldInput("street"));
      await user.type(fieldInput("street"), input.street);
      await user.clear(fieldInput("postalCode"));
      await user.type(fieldInput("postalCode"), input.postalCode);
      await user.click(formScope.getByTestId("create-user-submit"));
    },

    expectUserInList: async (email: string) => {
      // By what the user can read, not by a data attribute the markup happens
      // to carry — this driver's contract is user-perceivable state.
      await waitFor(() => {
        within(formScope.getByTestId("user-list")).getByText(email);
      });
    },

    expectFieldError: async (field: CreateUserField) => {
      // The error is announced, so assert on the role rather than on the
      // colour class it happens to be painted with.
      await waitFor(() => {
        const input = fieldInput(field);
        const control = input.closest("div") ?? missing(`no enclosing control for ${field}`);
        const alert = within(control).getByRole("alert");

        if (alert.textContent.length === 0) {
          throw new Error(`no error announced for ${field}`);
        }
      });
    },

    expectToast: async (kind: ToastKind, message: string) => {
      await waitFor(() => {
        // Matched by kind as well as text, so a mis-typed toast fails.
        const toasts = document.querySelectorAll(`[data-sonner-toast][data-type="${kind}"]`);
        const lowered = message.toLowerCase();
        const match = Array.from(toasts).some((t) => t.textContent.toLowerCase().includes(lowered));

        if (!match) {
          throw new Error(`expected ${kind} toast "${message}" in DOM, none found`);
        }
      });
    },
  };
};
