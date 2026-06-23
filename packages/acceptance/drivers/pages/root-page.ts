import { expect, type Locator, type Page } from "@playwright/test";

// Page Object for the root authed route (`/`) as a regular user: the org
// picker + create-organization form. Hides selectors behind domain-shaped
// methods. Super-admins are redirected away from `/`, so this driver is
// only meaningful under the member storageState.
export class RootPage {
  constructor(private readonly page: Page) {}

  public async visit(): Promise<void> {
    await this.page.goto("/");
    await expect(this.createOrgName).toBeVisible();
  }

  private get createOrgName(): Locator {
    return this.page.getByTestId("create-org-name");
  }

  private get createOrgSubmit(): Locator {
    return this.page.getByTestId("create-org-submit");
  }

  // Creates an org and returns its id. On success the app navigates to
  // `/orgs/:orgId` (create-org.presenter), so we read the id back out of
  // the settled URL — the caller lands on the new org's tasks page.
  public async createOrg(name: string): Promise<string> {
    await this.createOrgName.fill(name);
    await this.createOrgSubmit.click();
    await this.page.waitForURL(/\/orgs\/[0-9a-f-]+$/, { timeout: 15_000 });
    const match = /\/orgs\/([0-9a-f-]+)$/.exec(new URL(this.page.url()).pathname);
    if (match?.[1] === undefined) {
      throw new Error(`[RootPage] could not parse orgId from URL: ${this.page.url()}`);
    }
    return match[1];
  }
}
