import { expect, type Locator, type Page } from "@playwright/test";

export type CreateUserInput = {
  readonly email: string;
  readonly country: string;
  readonly street: string;
  readonly postalCode: string;
};

// Page Object for the users page (route: /users). Hides selectors behind
// domain methods (createUser, expectUserVisible) so specs read like
// requirements.
export class UsersPage {
  constructor(private readonly page: Page) {}

  public async visit(): Promise<void> {
    await this.page.goto("/users");
    await expect(this.email).toBeVisible();
  }

  private get email(): Locator {
    return this.page.getByTestId("create-user-email");
  }
  private get country(): Locator {
    return this.page.getByTestId("create-user-country");
  }
  private get street(): Locator {
    return this.page.getByTestId("create-user-street");
  }
  private get postalCode(): Locator {
    return this.page.getByTestId("create-user-postal-code");
  }
  private get submit(): Locator {
    return this.page.getByTestId("create-user-submit");
  }
  private get list(): Locator {
    return this.page.getByTestId("user-list");
  }

  public async createUser(input: CreateUserInput): Promise<void> {
    await this.email.fill(input.email);
    await this.country.fill(input.country);
    await this.street.fill(input.street);
    await this.postalCode.fill(input.postalCode);
    await this.submit.click();
  }

  public async expectUserVisible(email: string): Promise<void> {
    await expect(
      this.list.locator(`[data-testid="user-list-item"][data-user-email="${email}"]`),
    ).toBeVisible();
  }
}
