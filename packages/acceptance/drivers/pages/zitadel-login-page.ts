import { type Locator, type Page } from "@playwright/test";

// Page Object for Zitadel's hosted login UI. Two-step flow: enter email →
// Next → enter password → Sign in. We use IDs because the hosted markup
// labels are localized (Zitadel auto-detects browser locale), but IDs are
// stable across versions of v2.
export class ZitadelLoginPage {
  constructor(private readonly page: Page) {}

  private get usernameInput(): Locator {
    return this.page.locator("#loginName");
  }

  private get passwordInput(): Locator {
    return this.page.locator("#password");
  }

  private get submitButton(): Locator {
    return this.page.locator('button[type="submit"]');
  }

  // Zitadel's hosted UI prompts every fresh user to set up MFA after their
  // first password entry. The prompt has a `<button name="skip">` we can
  // dismiss to continue. Locally this prompt is invisible because the admin
  // user has already been bounced past it; in CI every run starts from a
  // fresh DB and hits it.
  private get mfaSkipButton(): Locator {
    return this.page.locator('button[name="skip"]');
  }

  public async signIn(email: string, password: string): Promise<void> {
    await this.usernameInput.waitFor({ state: "visible" });
    await this.usernameInput.fill(email);
    await this.submitButton.click();

    await this.passwordInput.waitFor({ state: "visible" });
    await this.passwordInput.fill(password);
    await this.submitButton.click();

    await this.skipMfaPromptIfShown();
  }

  private async skipMfaPromptIfShown(): Promise<void> {
    try {
      await this.mfaSkipButton.waitFor({ state: "visible", timeout: 3000 });
      await this.mfaSkipButton.click();
    } catch {
      // No MFA prompt — Zitadel must have decided this user has already
      // skipped it within MFAInitSkipLifetime. Nothing to do.
    }
  }
}
