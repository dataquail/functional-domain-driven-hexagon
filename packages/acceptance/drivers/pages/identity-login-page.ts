import { type Locator, type Page } from "@playwright/test";

// Page Object for the identity Worker's sign-in form: one page, email and
// password together.
export class IdentityLoginPage {
  constructor(private readonly page: Page) {}

  private get emailInput(): Locator {
    return this.page.getByLabel("Email");
  }

  private get passwordInput(): Locator {
    return this.page.getByLabel("Password");
  }

  private get submitButton(): Locator {
    return this.page.getByRole("button", { name: "Sign in" });
  }

  public async signIn(email: string, password: string): Promise<void> {
    await this.emailInput.waitFor({ state: "visible" });
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
