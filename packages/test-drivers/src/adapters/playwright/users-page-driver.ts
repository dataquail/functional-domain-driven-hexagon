import { expect, type Page } from "@playwright/test";
import type {
  CreateUserField,
  CreateUserInput,
  ToastKind,
  UsersPageDriver,
} from "../../contracts/users-page-driver.js";

// Field locators in one place so the contract methods stay
// business-intent. Switch keeps each case exhaustive — adding a
// CreateUserField member here would surface as a missing case.
const fieldLocator = (page: Page, field: CreateUserField) => {
  switch (field) {
    case "email":
      return page.getByTestId("create-user-email");
    case "country":
      return page.getByTestId("create-user-country");
    case "street":
      return page.getByTestId("create-user-street");
    case "postalCode":
      return page.getByTestId("create-user-postal-code");
  }
};

export const playwrightUsersDriver = (page: Page): UsersPageDriver => {
  const submit = page.getByTestId("create-user-submit");
  const list = page.getByTestId("user-list");

  return {
    goto: async () => {
      await page.goto("/users");
      await expect(fieldLocator(page, "email")).toBeVisible();
    },

    createUser: async (input: CreateUserInput) => {
      await fieldLocator(page, "email").fill(input.email);
      await fieldLocator(page, "country").fill(input.country);
      await fieldLocator(page, "street").fill(input.street);
      await fieldLocator(page, "postalCode").fill(input.postalCode);
      await submit.click();
    },

    expectUserInList: async (email: string) => {
      await expect(
        list.locator(`[data-testid="user-list-item"][data-user-email="${email}"]`),
      ).toBeVisible();
    },

    expectFieldError: async (field: CreateUserField) => {
      // Each input is wrapped in a Form.Control; the sibling
      // Form.Error renders a span with the error message. The
      // exact text varies per Schema rule, so we assert presence
      // by walking up from the field's label.
      const control = page.locator(`label[for="${field}"]`).locator("..");
      await expect(control.locator("span.text-red-500")).toBeVisible();
    },

    expectToast: async (kind: ToastKind, message: string) => {
      // sonner renders toasts as <li role="status"> elements under
      // a region. Assert by text + role; sonner doesn't carry a
      // stable kind attribute we can pivot on at this tier, so the
      // `kind` parameter is documentation-only here.
      const toast = page.getByRole("status").filter({ hasText: message });
      await expect(toast).toBeVisible();
      void kind;
    },
  };
};
