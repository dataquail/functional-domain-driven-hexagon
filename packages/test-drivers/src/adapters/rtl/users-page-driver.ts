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

// Optional toast adapter for the presenter tier, where toasts are
// captured by a `RecordingToast` and never reach the DOM. If not
// supplied, `expectToast` queries sonner's rendered DOM — which is
// what the integration harness mounts (`<Toaster />`).
export type RtlUsersDriverOptions = {
  readonly getToasts?: () => Promise<
    ReadonlyArray<{ readonly kind: ToastKind; readonly message: string }>
  >;
};

// `rendered` is the value returned from `@testing-library/react`'s
// `render(...)`. Caller supplies it so this adapter doesn't pin a
// specific rendering wrapper; the integration harness and presenter
// harness mount their own providers.
export const rtlUsersDriver = (
  rendered: RenderResult,
  opts: RtlUsersDriverOptions = {},
): UsersPageDriver => {
  const user = userEvent.setup();
  // sonner's <Toaster /> renders to document.body, not inside
  // `rendered.container`. Use `within(document.body)` to find it.
  const formScope = within(rendered.container);
  const bodyScope = within(document.body);

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
      await waitFor(() => {
        const list = formScope.getByTestId("user-list");
        const match = list.querySelector(`[data-user-email="${email}"]`);
        if (match === null) {
          throw new Error(`user-list does not contain user with email ${email}`);
        }
      });
    },

    expectFieldError: async (field: CreateUserField) => {
      await waitFor(() => {
        // The form's `Form.Error` span renders adjacent to each
        // input. Locate it by walking up from the field's input.
        const input = fieldInput(field);
        const parent = input.closest("div");
        if (parent === null) throw new Error(`no enclosing control for ${field}`);
        const errorSpan = parent.querySelector("span.text-red-500");
        const text = errorSpan?.textContent;
        if (text === null || text === undefined || text.length === 0) {
          throw new Error(`no error for ${field}`);
        }
      });
    },

    expectToast: async (kind: ToastKind, message: string) => {
      const getToasts = opts.getToasts;
      await waitFor(async () => {
        if (getToasts !== undefined) {
          const toasts = await getToasts();
          const found = toasts.some((t) => t.kind === kind && t.message === message);
          if (!found) {
            throw new Error(`expected ${kind} toast "${message}", got ${JSON.stringify(toasts)}`);
          }
          return;
        }
        // sonner default: each toast renders as a <li> under a region
        // with role="status". Filter by message text.
        const matches = bodyScope.queryAllByText(message, { exact: false });
        if (matches.length === 0) {
          throw new Error(`expected ${kind} toast "${message}" in DOM, none found`);
        }
      });
    },
  };
};
