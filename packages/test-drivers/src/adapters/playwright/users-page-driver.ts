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
      // By what the user can read, not by a data attribute the markup happens
      // to carry — this driver's contract is user-perceivable state.
      await expect(list.getByText(email)).toBeVisible();
    },

    expectFieldError: async (field: CreateUserField) => {
      // Each input sits in a Form.Control alongside its Form.Error, which is
      // announced. Assert on the role; the message text varies per Schema rule.
      const control = page.locator(`label[for="${field}"]`).locator("..");
      await expect(control.getByRole("alert")).toBeVisible();
    },

    expectToast: async (kind: ToastKind, message: string) => {
      // sonner v2 renders each toast as `<li data-sonner-toast
      // data-type="success|error|...">`. Earlier this driver looked for
      // `role="status"`, but sonner v2 doesn't set that role — happy-path
      // specs that only call `expectUserInList` never exercised this
      // method, so the bug stayed hidden until a negative-path spec ran
      // it. `data-sonner-toast` is sonner's stable attribute and
      // `data-type` lets us pin the kind that was previously
      // documentation-only.
      const toast = page
        .locator(`[data-sonner-toast][data-type="${kind}"]`)
        .filter({ hasText: message });
      await expect(toast).toBeVisible();
    },
  };
};
