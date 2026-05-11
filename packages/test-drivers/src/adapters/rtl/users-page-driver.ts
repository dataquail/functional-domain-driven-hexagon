import { type RenderResult, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type {
  CreateUserField,
  CreateUserInput,
  ToastKind,
  UsersPageDriver,
} from "../../contracts/users-page-driver.js";

const testIdByField: Record<CreateUserField, string> = {
  email: "create-user-email",
  country: "create-user-country",
  street: "create-user-street",
  postalCode: "create-user-postal-code",
};

type ToastQuery = {
  readonly getToasts: () => Promise<
    ReadonlyArray<{ readonly kind: ToastKind; readonly message: string }>
  >;
};

export type RtlUsersDriverOptions = ToastQuery;

// `render` here is the value returned from `@testing-library/react`'s
// `render(...)`. Caller supplies it so this adapter doesn't pin a
// specific rendering wrapper; the integration harness and presenter
// harness mount their own providers.
export const rtlUsersDriver = (
  rendered: RenderResult,
  opts: RtlUsersDriverOptions,
): UsersPageDriver => {
  const user = userEvent.setup();
  const scope = within(rendered.container);

  const fieldInput = (field: CreateUserField) => scope.getByTestId(testIdByField[field]);

  return {
    goto: async () => {
      // RTL doesn't navigate; the caller already mounted the page.
      // Assert that the form is ready so subsequent interactions
      // have something to drive.
      await waitFor(() => {
        scope.getByTestId("create-user-email");
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
      await user.click(scope.getByTestId("create-user-submit"));
    },

    expectUserInList: async (email: string) => {
      await waitFor(() => {
        const list = scope.getByTestId("user-list");
        const match = list.querySelector(`[data-user-email="${email}"]`);
        if (match === null) {
          throw new Error(`user-list does not contain user with email ${email}`);
        }
      });
    },

    expectFieldError: async (field: CreateUserField) => {
      await waitFor(() => {
        // The form's `Form.Error` span renders adjacent to each
        // input. Locate it by walking up from the field's label.
        const input = fieldInput(field);
        const parent = input.closest("div");
        if (parent === null) throw new Error(`no enclosing control for ${field}`);
        const errorSpan = parent.querySelector("span.text-red-500");
        if (errorSpan?.textContent === null || errorSpan?.textContent === undefined) {
          throw new Error(`no error for ${field}`);
        }
      });
    },

    expectToast: async (kind: ToastKind, message: string) => {
      await waitFor(async () => {
        const toasts = await opts.getToasts();
        const found = toasts.some((t) => t.kind === kind && t.message === message);
        if (!found) {
          throw new Error(
            `expected ${kind} toast with message "${message}", got ${JSON.stringify(toasts)}`,
          );
        }
      });
    },
  };
};
